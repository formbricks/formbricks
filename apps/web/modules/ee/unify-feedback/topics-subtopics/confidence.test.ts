import { describe, expect, test } from "vitest";
import {
  SEMANTIC_SEARCH_MIN_SCORE,
  getSemanticSearchConfidenceLevel,
  getSemanticSearchDisplayScore,
} from "./confidence";

describe("getSemanticSearchConfidenceLevel", () => {
  test("classifies normalized display scores in thirds", () => {
    const mediumConfidenceThreshold = 1 / 3;
    const highConfidenceThreshold = 2 / 3;

    expect(getSemanticSearchConfidenceLevel(0)).toBe("low");
    expect(getSemanticSearchConfidenceLevel(mediumConfidenceThreshold - Number.EPSILON)).toBe("low");
    expect(getSemanticSearchConfidenceLevel(mediumConfidenceThreshold)).toBe("medium");
    expect(getSemanticSearchConfidenceLevel(highConfidenceThreshold - Number.EPSILON)).toBe("medium");
    expect(getSemanticSearchConfidenceLevel(highConfidenceThreshold)).toBe("high");
    expect(getSemanticSearchConfidenceLevel(1)).toBe("high");
  });
});

describe("getSemanticSearchDisplayScore", () => {
  test("normalizes raw scores to the cutoff and applies a square-root curve", () => {
    expect(SEMANTIC_SEARCH_MIN_SCORE).toBe(0.5);

    expect(getSemanticSearchDisplayScore(0.5)).toBe(0);
    expect(getSemanticSearchDisplayScore(0.625)).toBe(0.5);
    expect(getSemanticSearchDisplayScore(1)).toBe(1);
  });

  test("clamps raw scores outside the supported range", () => {
    expect(getSemanticSearchDisplayScore(0.4)).toBe(0);
    expect(getSemanticSearchDisplayScore(1.2)).toBe(1);
  });
});
