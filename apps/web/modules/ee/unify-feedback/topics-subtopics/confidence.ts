export const SEMANTIC_SEARCH_MIN_SCORE = 0.5;

const MEDIUM_CONFIDENCE_THRESHOLD = 0.6666666667;
const HIGH_CONFIDENCE_THRESHOLD = 0.8333333333;

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
