import { describe, expect, it } from "vitest";
import { getCallbackUrl } from "../utils";

describe("getCallbackUrl", () => {
  it("should return base URL with source when no inviteUrl is provided", () => {
    const result = getCallbackUrl(undefined, "test-source");
    expect(result).toBe("/?source=test-source");
  });

  it("should append source parameter to inviteUrl with existing query parameters", () => {
    const result = getCallbackUrl("https://example.com/invite?param=value", "test-source");
    expect(result).toBe("https://example.com/invite?param=value&source=test-source");
  });

  it("should append source parameter to inviteUrl without existing query parameters", () => {
    const result = getCallbackUrl("https://example.com/invite", "test-source");
    expect(result).toBe("https://example.com/invite?source=test-source");
  });

  it("should handle empty source parameter", () => {
    const result = getCallbackUrl("https://example.com/invite", "");
    expect(result).toBe("https://example.com/invite?source=");
  });

  it("should handle undefined source parameter", () => {
    const result = getCallbackUrl("https://example.com/invite", undefined);
    expect(result).toBe("https://example.com/invite?source=undefined");
  });
});
