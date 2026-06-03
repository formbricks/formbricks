// Keep this UI cutoff in sync with the Hub/backend semantic-search cutoff when backend filtering changes.
export const SEMANTIC_SEARCH_MIN_SCORE = 0.5;

const MEDIUM_CONFIDENCE_THRESHOLD = 1.0 / 3.0;
const HIGH_CONFIDENCE_THRESHOLD = 2.0 / 3.0;

export type TSemanticSearchConfidenceLevel = "low" | "medium" | "high";

export const getSemanticSearchConfidenceLevel = (score: number): TSemanticSearchConfidenceLevel => {
  if (score >= HIGH_CONFIDENCE_THRESHOLD) {
    return "high";
  }

  if (score >= MEDIUM_CONFIDENCE_THRESHOLD) {
    return "medium";
  }

  return "low";
};

export const getSemanticSearchDisplayScore = (score: number): number => {
  const normalizedScore = (score - SEMANTIC_SEARCH_MIN_SCORE) / (1 - SEMANTIC_SEARCH_MIN_SCORE);
  const clampedScore = Math.min(Math.max(normalizedScore, 0), 1);

  return Math.sqrt(clampedScore);
};
