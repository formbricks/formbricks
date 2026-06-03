import { describe, expect, test } from "vitest";
import { SEMANTIC_SEARCH_MIN_SCORE, getSemanticSearchConfidenceLevel } from "./confidence";

describe("getSemanticSearchConfidenceLevel", () => {
  test("classifies scores in thirds from the minimum semantic search score", () => {
    expect(SEMANTIC_SEARCH_MIN_SCORE).toBe(0.5);

    expect(getSemanticSearchConfidenceLevel(0.5)).toBe("low");
    expect(getSemanticSearchConfidenceLevel(0.6666666666)).toBe("low");
    expect(getSemanticSearchConfidenceLevel(0.6666666667)).toBe("medium");
    expect(getSemanticSearchConfidenceLevel(0.8333333332)).toBe("medium");
    expect(getSemanticSearchConfidenceLevel(0.8333333333)).toBe("high");
    expect(getSemanticSearchConfidenceLevel(1)).toBe("high");
  });
});
