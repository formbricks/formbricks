import { describe, expect, test } from "vitest";
import { getCallbackUrl } from "../utils";

describe("getCallbackUrl", () => {
  test("should return base URL with source when no inviteUrl is provided", () => {
    const result = getCallbackUrl(undefined, "test-source");
    expect(result).toBe("/?source=test-source");
  });

  test("should append source parameter to inviteUrl with existing query parameters", () => {
    const result = getCallbackUrl("https://example.com/invite?param=value", "test-source");
    expect(result).toBe("https://example.com/invite?param=value&source=test-source");
  });

  test("should append source parameter to inviteUrl without existing query parameters", () => {
    const result = getCallbackUrl("https://example.com/invite", "test-source");
    expect(result).toBe("https://example.com/invite?source=test-source");
  });

  test("should handle empty source parameter", () => {
    const result = getCallbackUrl("https://example.com/invite", "");
    expect(result).toBe("https://example.com/invite");
  });

  test("should avoid serializing undefined source parameters", () => {
    const result = getCallbackUrl("https://example.com/invite", undefined);
    expect(result).toBe("https://example.com/invite");
  });

  test("should replace an existing source parameter instead of duplicating it", () => {
    const result = getCallbackUrl("https://example.com/invite?source=signup&token=abc", "signin");
    expect(result).toBe("https://example.com/invite?source=signin&token=abc");
  });
});
