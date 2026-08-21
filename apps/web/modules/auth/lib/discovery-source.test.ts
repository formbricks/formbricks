import { describe, expect, test } from "vitest";
import {
  MAX_DISCOVERY_SOURCE_DETAIL_LENGTH,
  ZDiscoverySourceDetail,
  normalizeDiscoverySourceDetail,
} from "./discovery-source";

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

describe("ZDiscoverySourceDetail", () => {
  // Regression: the max-length check must run on the TRIMMED value, or whitespace padding could push
  // otherwise-valid content over the limit and reject it before normalizeDiscoverySourceDetail ever
  // gets a chance to trim it.
  test("trims before enforcing the max length, so padding within the limit is accepted", () => {
    const content = "a".repeat(MAX_DISCOVERY_SOURCE_DETAIL_LENGTH);
    const padded = `  ${content}  `;

    expect(ZDiscoverySourceDetail.parse(padded)).toBe(content);
  });

  test("rejects content that still exceeds the limit after trimming", () => {
    const tooLong = "a".repeat(MAX_DISCOVERY_SOURCE_DETAIL_LENGTH + 1);

    expect(() => ZDiscoverySourceDetail.parse(tooLong)).toThrow();
  });

  test("parses undefined as undefined", () => {
    expect(ZDiscoverySourceDetail.parse(undefined)).toBeUndefined();
  });
});
