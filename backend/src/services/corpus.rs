use anyhow::{bail, Context, Result};
use std::collections::HashSet;
use uuid::Uuid;

use crate::{db::DbManager, models::CorpusPassage};

pub const VALID_DOMAINS: &[&str] = &[
    "general_humanities",
    "physics",
    "chemistry",
    "computer_science",
    "biology",
];

/// Normalizes a domain or custom topic string into a clean snake_case key (e.g. "Art History" -> "art_history").
pub fn normalize_domain(domain: &str) -> String {
    let trimmed = domain.trim().to_lowercase();
    let mut normalized = String::with_capacity(trimmed.len());
    let mut last_was_sep = false;

    for ch in trimmed.chars() {
        if ch.is_ascii_alphanumeric() {
            normalized.push(ch);
            last_was_sep = false;
        } else if (ch == ' ' || ch == '_' || ch == '-' || ch == '&') && !last_was_sep && !normalized.is_empty() {
            normalized.push('_');
            last_was_sep = true;
        }
    }

    normalized.trim_end_matches('_').to_string()
}

/// Validates whether a domain/topic string is either one of the built-in domains or a clean custom topic
pub fn is_valid_domain(domain: &str) -> bool {
    let trimmed = domain.trim();
    if trimmed.is_empty() || trimmed.len() > 50 {
        return false;
    }
    if trimmed.eq_ignore_ascii_case("other") {
        return false;
    }
    trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == ' ' || c == '&')
        && trimmed.chars().any(|c| c.is_ascii_alphabetic())
}

/// Counts words separated by whitespace
pub fn count_words(text: &str) -> usize {
    text.split_whitespace().count()
}

/// Computes the lexical density (content words / total words)
/// Uses a comprehensive English stop word dictionary.
pub fn calculate_lexical_density(text: &str) -> f64 {
    let total_words = count_words(text);
    if total_words == 0 {
        return 0.0;
    }

    let stop_words: HashSet<&'static str> = [
        "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
        "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
        "but", "by", "can", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't",
        "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't",
        "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here",
        "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll",
        "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's",
        "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on",
        "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own",
        "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some",
        "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then",
        "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this",
        "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we",
        "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's",
        "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with",
        "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your",
        "yours", "yourself", "yourselves",
    ]
    .into_iter()
    .collect();

    let mut content_words = 0;
    for token in text.split_whitespace() {
        let cleaned: String = token
            .chars()
            .filter(|c| c.is_alphabetic())
            .collect::<String>()
            .to_lowercase();

        if !cleaned.is_empty() && !stop_words.contains(cleaned.as_str()) {
            content_words += 1;
        }
    }

    let density = content_words as f64 / total_words as f64;
    (density * 1000.0).round() / 1000.0
}

/// Sanitizes raw input text by normalizing line endings and removing excessive whitespace
pub fn sanitize_text(text: &str) -> String {
    let normalized = text.replace("\r\n", "\n").replace('\r', "\n");
    let paragraphs: Vec<&str> = normalized
        .split("\n\n")
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .collect();

    paragraphs.join("\n\n")
}

/// Chunks arbitrary text into passages between min_words and max_words.
/// Respects paragraph and sentence boundaries without slicing mid-sentence.
pub fn chunk_text(text: &str, min_words: usize, max_words: usize) -> Vec<String> {
    let sanitized = sanitize_text(text);
    let total = count_words(&sanitized);

    if total == 0 {
        return Vec::new();
    }

    if total <= max_words {
        return vec![sanitized];
    }

    let paragraphs: Vec<&str> = sanitized
        .split("\n\n")
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .collect();

    let mut chunks = Vec::new();
    let mut current_chunk = Vec::new();
    let mut current_count = 0;

    for para in paragraphs {
        let para_words = count_words(para);

        // If a single paragraph is larger than max_words, chunk by sentences
        if para_words > max_words {
            if !current_chunk.is_empty() {
                chunks.push(current_chunk.join("\n\n"));
                current_chunk.clear();
                current_count = 0;
            }

            let sentence_chunks = chunk_paragraph_by_sentences(para, min_words, max_words);
            chunks.extend(sentence_chunks);
            continue;
        }

        if current_count + para_words <= max_words {
            current_chunk.push(para.to_string());
            current_count += para_words;
        } else if current_count >= min_words {
            chunks.push(current_chunk.join("\n\n"));
            current_chunk = vec![para.to_string()];
            current_count = para_words;
        } else {
            // Below min_words, merge anyway to keep cohesive block
            current_chunk.push(para.to_string());
            chunks.push(current_chunk.join("\n\n"));
            current_chunk.clear();
            current_count = 0;
        }
    }

    if !current_chunk.is_empty() {
        let remaining = current_chunk.join("\n\n");
        // If the leftover is tiny (< min_words / 2) and we already have a chunk, merge it with previous
        if count_words(&remaining) < (min_words / 2) && !chunks.is_empty() {
            let last_idx = chunks.len() - 1;
            chunks[last_idx] = format!("{}\n\n{}", chunks[last_idx], remaining);
        } else {
            chunks.push(remaining);
        }
    }

    chunks
}

/// Helper to chunk a single long paragraph into sentences
fn chunk_paragraph_by_sentences(para: &str, min_words: usize, max_words: usize) -> Vec<String> {
    // Split sentences by punctuation (.!?) followed by space
    let mut sentences = Vec::new();
    let mut current_sentence = String::new();

    let chars: Vec<char> = para.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        current_sentence.push(chars[i]);
        if (chars[i] == '.' || chars[i] == '!' || chars[i] == '?')
            && (i + 1 == len || chars[i + 1].is_whitespace())
        {
            sentences.push(current_sentence.trim().to_string());
            current_sentence.clear();
        }
        i += 1;
    }

    if !current_sentence.trim().is_empty() {
        sentences.push(current_sentence.trim().to_string());
    }

    let mut chunks = Vec::new();
    let mut current_chunk = Vec::new();
    let mut current_count = 0;

    for s in sentences {
        let s_count = count_words(&s);
        if current_count + s_count <= max_words {
            current_chunk.push(s);
            current_count += s_count;
        } else if current_count >= min_words {
            chunks.push(current_chunk.join(" "));
            current_chunk = vec![s];
            current_count = s_count;
        } else {
            current_chunk.push(s);
            chunks.push(current_chunk.join(" "));
            current_chunk.clear();
            current_count = 0;
        }
    }

    if !current_chunk.is_empty() {
        chunks.push(current_chunk.join(" "));
    }

    chunks
}

/// Computes the difficulty score and tier ('Easy' | 'Medium' | 'Hard') matching the frontend algorithm.
pub fn calculate_difficulty_tier(text: &str, density: f64) -> &'static str {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return "Easy";
    }
    let words: Vec<&str> = trimmed.split_whitespace().collect();
    let word_count = words.len().max(1);
    let sentences = trimmed
        .split(|c| c == '.' || c == '!' || c == '?')
        .filter(|s| !s.trim().is_empty())
        .count()
        .max(1);

    let long_words_count = words
        .iter()
        .filter(|w| w.chars().filter(|c| c.is_ascii_alphabetic()).count() >= 7)
        .count();

    let long_words_ratio = long_words_count as f64 / word_count as f64;
    let avg_sent_len = word_count as f64 / sentences as f64;
    let score = long_words_ratio * 100.0 + density * 50.0 + avg_sent_len * 0.5;

    if score < 72.0 {
        "Easy"
    } else if score < 76.0 {
        "Medium"
    } else {
        "Hard"
    }
}

/// Calibrates the stored density score if the user explicitly selected a target difficulty tier
/// ('Easy', 'Medium', or 'Hard') during ingestion so the passage consistently maps to that tier.
pub fn calibrate_density_for_difficulty(
    text: &str,
    raw_density: f64,
    target_difficulty: Option<&str>,
) -> f64 {
    let Some(target) = target_difficulty.map(|d| d.trim()) else {
        return raw_density;
    };
    if target.is_empty() || target.eq_ignore_ascii_case("auto") {
        return raw_density;
    }

    let current_tier = calculate_difficulty_tier(text, raw_density);
    if current_tier.eq_ignore_ascii_case(target) {
        return raw_density;
    }

    let trimmed = text.trim();
    let words: Vec<&str> = trimmed.split_whitespace().collect();
    let word_count = words.len().max(1);
    let sentences = trimmed
        .split(|c| c == '.' || c == '!' || c == '?')
        .filter(|s| !s.trim().is_empty())
        .count()
        .max(1);
    let long_words_count = words
        .iter()
        .filter(|w| w.chars().filter(|c| c.is_ascii_alphabetic()).count() >= 7)
        .count();

    let long_words_ratio = long_words_count as f64 / word_count as f64;
    let avg_sent_len = word_count as f64 / sentences as f64;
    let base_without_density = long_words_ratio * 100.0 + avg_sent_len * 0.5;

    let target_score = if target.eq_ignore_ascii_case("Easy") {
        68.0
    } else if target.eq_ignore_ascii_case("Medium") {
        74.0
    } else if target.eq_ignore_ascii_case("Hard") {
        80.0
    } else {
        return raw_density;
    };

    let calibrated = ((target_score - base_without_density) / 50.0).clamp(0.05, 0.99);
    (calibrated * 1000.0).round() / 1000.0
}

/// Ingests a text into the reading corpus, chunking if necessary.
pub async fn ingest_text(
    db: &DbManager,
    title: &str,
    domain: &str,
    attribution: &str,
    raw_text: &str,
) -> Result<Vec<CorpusPassage>> {
    ingest_text_with_difficulty(db, title, domain, attribution, raw_text, None).await
}

/// Ingests a text into the reading corpus with an optional difficulty tier override.
pub async fn ingest_text_with_difficulty(
    db: &DbManager,
    title: &str,
    domain: &str,
    attribution: &str,
    raw_text: &str,
    difficulty: Option<&str>,
) -> Result<Vec<CorpusPassage>> {
    let title = title.trim();
    let attribution = attribution.trim();

    if title.is_empty() {
        bail!("Title cannot be empty");
    }
    if attribution.is_empty() {
        bail!("Source attribution cannot be empty");
    }
    if !is_valid_domain(domain) {
        bail!("Invalid topic/domain: '{}'", domain.trim());
    }
    let domain = normalize_domain(domain);
    if count_words(raw_text) == 0 {
        bail!("Text cannot be empty");
    }

    let chunks = chunk_text(raw_text, 150, 450);
    let mut created_passages = Vec::new();
    let conn = db.connect().context("Failed to obtain DB connection")?;

    for (idx, chunk) in chunks.into_iter().enumerate() {
        let chunk_title = if idx == 0 {
            title.to_string()
        } else {
            format!("{title} (Part {})", idx + 1)
        };

        let word_count = count_words(&chunk) as i64;
        let raw_density = calculate_lexical_density(&chunk);
        let density = calibrate_density_for_difficulty(&chunk, raw_density, difficulty);
        let id = format!("corpus_{}", Uuid::new_v4().simple());

        conn.execute(
            "INSERT INTO reading_corpus (id, title, domain, source_attribution, passage_text, word_count, lexical_density_score)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            libsql::params![
                id.clone(),
                chunk_title.clone(),
                domain.clone(),
                attribution.to_string(),
                chunk.clone(),
                word_count,
                density
            ],
        )
        .await
        .context("Failed to insert corpus passage")?;

        created_passages.push(CorpusPassage {
            id,
            title: chunk_title,
            domain: domain.clone(),
            source_attribution: attribution.to_string(),
            passage_text: chunk,
            word_count,
            lexical_density_score: Some(density),
            created_at: None,
        });
    }

    Ok(created_passages)
}
