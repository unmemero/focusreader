import type { CorpusPassage } from '../types';

export type DifficultyTier = 'Easy' | 'Medium' | 'Hard';

export interface DifficultyInfo {
  tier: DifficultyTier;
  score: number;
  order: number; // 1 = Easy, 2 = Medium, 3 = Hard
  badgeClass: string;
}

const TOPIC_LABELS: Record<string, string> = {
  general_humanities: 'Humanities',
  computer_science: 'Computer Science',
  physics: 'Physics',
  chemistry: 'Chemistry',
  biology: 'Biology',
};

/**
 * Formats a raw domain key into regular Title Case for tags.
 */
export function formatTopicLabel(domain: string): string {
  if (TOPIC_LABELS[domain]) {
    return TOPIC_LABELS[domain];
  }
  return domain
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Computes a classroom-friendly difficulty tier (Easy / Medium / Hard)
 * from a passage's vocabulary complexity (long words + lexical density)
 * and average sentence length.
 */
export function getPassageDifficulty(
  passage: Pick<CorpusPassage, 'passage_text' | 'lexical_density_score'>
): DifficultyInfo {
  const text = (passage.passage_text || '').trim();
  const words = text ? text.split(/\s+/) : [];
  const wordCount = words.length || 1;
  const sentences = text
    ? text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
    : [];
  const sentenceCount = sentences.length || 1;

  const longWordsCount = words.filter(
    (w) => w.replace(/[^a-zA-Z]/g, '').length >= 7
  ).length;
  const longWordsRatio = longWordsCount / wordCount;
  const avgSentLen = wordCount / sentenceCount;
  const density = passage.lexical_density_score ?? 0.55;

  const score = longWordsRatio * 100 + density * 50 + avgSentLen * 0.5;

  if (score < 72) {
    return {
      tier: 'Easy',
      score,
      order: 1,
      badgeClass: 'border-emerald-600/35 bg-emerald-950/50 text-emerald-300',
    };
  }
  if (score < 76) {
    return {
      tier: 'Medium',
      score,
      order: 2,
      badgeClass: 'border-amber-600/35 bg-amber-950/50 text-amber-300',
    };
  }
  return {
    tier: 'Hard',
    score,
    order: 3,
    badgeClass: 'border-rose-600/35 bg-rose-950/50 text-rose-300',
  };
}
