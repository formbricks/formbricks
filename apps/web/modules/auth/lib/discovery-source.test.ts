import { describe, expect, test } from "vitest";
import { normalizeDiscoverySourceDetail } from "./discovery-source";

describe("normalizeDiscoverySourceDetail", () => {
  test("keeps a trimmed detail for a source that takes a follow-up", () => {
    expect(normalizeDiscoverySourceDetail("blog", "  formbricks.com/blog/x  ")).toBe("formbricks.com/blog/x");
  });

  test("drops a whitespace-only detail", () => {
    expect(normalizeDiscoverySourceDetail("llm", "   ")).toBeUndefined();
  });

  test("drops the detail when no discoverySource is set", () => {
    expect(normalizeDiscoverySourceDetail(undefined, "some stray text")).toBeUndefined();
  });

  test("drops the detail when the source doesn't take a follow-up", () => {
    expect(normalizeDiscoverySourceDetail("referral", "some stray text")).toBeUndefined();
  });

  test("returns undefined when no detail was provided", () => {
    expect(normalizeDiscoverySourceDetail("blog", undefined)).toBeUndefined();
  });
});
