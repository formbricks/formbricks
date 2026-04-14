import { describe, expect, test } from "vitest";
import { getSsoReturnToUrl } from "../utils";

describe("getSsoReturnToUrl", () => {
  test("should return base URL with source when no return URL is provided", () => {
    const result = getSsoReturnToUrl(undefined, "test-source");
    expect(result).toBe("/?source=test-source");
  });

  test("should append source parameter to the return URL with existing query parameters", () => {
    const result = getSsoReturnToUrl("https://example.com/invite?param=value", "test-source");
    expect(result).toBe("https://example.com/invite?param=value&source=test-source");
  });

  test("should append source parameter to the return URL without existing query parameters", () => {
    const result = getSsoReturnToUrl("https://example.com/invite", "test-source");
    expect(result).toBe("https://example.com/invite?source=test-source");
  });

  test("should handle empty source parameter", () => {
    const result = getSsoReturnToUrl("https://example.com/invite", "");
    expect(result).toBe("https://example.com/invite");
  });

  test("should avoid serializing undefined source parameters", () => {
    const result = getSsoReturnToUrl("https://example.com/invite", undefined);
    expect(result).toBe("https://example.com/invite");
  });

  test("should replace an existing source parameter instead of duplicating it", () => {
    const result = getSsoReturnToUrl("https://example.com/invite?source=signup&token=abc", "signin");
    expect(result).toBe("https://example.com/invite?source=signin&token=abc");
  });
});
