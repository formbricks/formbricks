import { describe, expect, test } from "vitest";
import { withoutTrailingSlashes } from "./url";

describe("withoutTrailingSlashes", () => {
  test("drops every trailing slash and nothing else", () => {
    expect(withoutTrailingSlashes("https://app.example.com///")).toBe("https://app.example.com");
    expect(withoutTrailingSlashes("https://app.example.com/a/b")).toBe("https://app.example.com/a/b");
    expect(withoutTrailingSlashes("///")).toBe("");
  });

  test("stays fast on a long run of slashes that does not end the string", () => {
    const input = `${"/".repeat(100_000)}x`;
    const started = performance.now();
    expect(withoutTrailingSlashes(input)).toBe(input);
    expect(performance.now() - started).toBeLessThan(100);
  });
});
