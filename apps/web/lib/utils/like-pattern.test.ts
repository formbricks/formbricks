import { describe, expect, test } from "vitest";
import { escapeLikePattern } from "./like-pattern";

describe("escapeLikePattern", () => {
  test("escapes the LIKE wildcards and the escape character itself", () => {
    expect(escapeLikePattern("100%")).toBe(String.raw`100\%`);
    expect(escapeLikePattern("q_3")).toBe(String.raw`q\_3`);
    expect(escapeLikePattern(String.raw`a\b`)).toBe(String.raw`a\\b`);
  });

  test("leaves everything else alone", () => {
    expect(escapeLikePattern("Site visit feedback (2023)")).toBe("Site visit feedback (2023)");
  });
});
