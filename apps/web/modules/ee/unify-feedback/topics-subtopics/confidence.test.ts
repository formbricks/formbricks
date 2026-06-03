import { describe, expect, test } from "vitest";
import {
  SEMANTIC_SEARCH_MIN_SCORE,
  getSemanticSearchConfidenceLevel,
  getSemanticSearchDisplayScore,
} from "./confidence";

describe("getSemanticSearchConfidenceLevel", () => {
  test("classifies normalized display scores in thirds", () => {
    expect(getSemanticSearchConfidenceLevel(0)).toBe("low");
    expect(getSemanticSearchConfidenceLevel(0.3333333332)).toBe("low");
    expect(getSemanticSearchConfidenceLevel(0.3333333333)).toBe("medium");
    expect(getSemanticSearchConfidenceLevel(0.6666666666)).toBe("medium");
    expect(getSemanticSearchConfidenceLevel(0.6666666667)).toBe("high");
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
