use focusreader_backend::services::corpus::{
    calculate_lexical_density, chunk_text, count_words, is_valid_domain, sanitize_text,
    VALID_DOMAINS,
};

#[test]
fn test_count_words() {
    assert_eq!(count_words(""), 0);
    assert_eq!(count_words("   "), 0);
    assert_eq!(count_words("Hello world"), 2);
    assert_eq!(count_words("  The   quick   brown  fox \n jumps!  "), 5);
}

#[test]
fn test_lexical_density() {
    // Pure function words
    assert_eq!(calculate_lexical_density(""), 0.0);
    let low_density = calculate_lexical_density("the and or but if because to in of");
    assert_eq!(low_density, 0.0);

    // Highly dense scientific vocabulary
    let high_density = calculate_lexical_density("Electrodynamics relativity quantum spacetime photon electromagnetic");
    assert!(high_density > 0.8, "Expected high lexical density, got {high_density}");

    // Standard English prose should generally be between 0.35 and 0.65
    let normal_text = "The quick brown fox jumps over the lazy dog in the sunny park.";
    let normal_density = calculate_lexical_density(normal_text);
    assert!(normal_density > 0.3 && normal_density < 0.8, "Density {normal_density} was out of expected range");
}

#[test]
fn test_sanitize_text() {
    let dirty = "Hello world\r\n\r\nThis is a paragraph.\r\n\r\n\r\nAnother one.";
    let clean = sanitize_text(dirty);
    assert_eq!(clean, "Hello world\n\nThis is a paragraph.\n\nAnother one.");
}

#[test]
fn test_chunk_text_short_passage() {
    let short_text = "This is a short text that does not need chunking. It should remain intact.";
    let chunks = chunk_text(short_text, 150, 450);
    assert_eq!(chunks.len(), 1);
    assert_eq!(chunks[0], short_text);
}

#[test]
fn test_chunk_text_long_document() {
    // Generate a long text with 4 distinct paragraphs, totaling ~500 words
    let para1 = "Paragraph one discusses fundamental principles of algorithmic complexity. ".repeat(20);
    let para2 = "Paragraph two describes memory bandwidth constraints and cache coherence. ".repeat(20);
    let para3 = "Paragraph three explores distributed consensus algorithms across noisy networks. ".repeat(20);
    let long_doc = format!("{para1}\n\n{para2}\n\n{para3}");

    let total_words = count_words(&long_doc);
    assert!(total_words > 400, "Generated text should be > 400 words, got {total_words}");

    let chunks = chunk_text(&long_doc, 100, 250);
    assert!(chunks.len() >= 2, "Expected multiple chunks, got {}", chunks.len());

    for (i, chunk) in chunks.iter().enumerate() {
        let chunk_words = count_words(chunk);
        assert!(chunk_words > 50, "Chunk {i} word count {chunk_words} is unexpectedly small");
    }
}

#[test]
fn test_valid_domains() {
    for domain in VALID_DOMAINS {
        assert!(is_valid_domain(domain));
    }
    assert!(is_valid_domain("Psychology"));
    assert!(is_valid_domain("Art History"));
    assert_eq!(
        focusreader_backend::services::corpus::normalize_domain("Art History"),
        "art_history"
    );
    assert!(!is_valid_domain(""));
    assert!(!is_valid_domain("other"));
    assert!(!is_valid_domain("physics; DROP TABLE reading_corpus;"));
}
