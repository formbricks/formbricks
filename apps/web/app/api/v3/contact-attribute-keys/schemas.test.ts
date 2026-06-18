import { describe, expect, test } from "vitest";
import { ZV3ContactAttributeKeyListQuery } from "./schemas";

describe("ZV3ContactAttributeKeyListQuery", () => {
  test("accepts a valid cuid2 workspaceId", () => {
    const result = ZV3ContactAttributeKeyListQuery.safeParse({ workspaceId: "clseedworkspace000000000" });
    expect(result.success).toBe(true);
  });

  test("rejects a missing workspaceId", () => {
    expect(ZV3ContactAttributeKeyListQuery.safeParse({}).success).toBe(false);
  });

  test("rejects a non-cuid2 workspaceId", () => {
    expect(ZV3ContactAttributeKeyListQuery.safeParse({ workspaceId: "not a cuid" }).success).toBe(false);
  });

  test("rejects unknown query keys (strict)", () => {
    const result = ZV3ContactAttributeKeyListQuery.safeParse({
      workspaceId: "clseedworkspace000000000",
      offset: 5,
    });
    expect(result.success).toBe(false);
  });

  test("defaults, coerces, and accepts limit + cursor", () => {
    const dflt = ZV3ContactAttributeKeyListQuery.safeParse({ workspaceId: "clseedworkspace000000000" });
    expect(dflt.success).toBe(true);
    if (dflt.success) expect(dflt.data.limit).toBe(50);

    const parsed = ZV3ContactAttributeKeyListQuery.safeParse({
      workspaceId: "clseedworkspace000000000",
      limit: "25",
      cursor: "abc",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.limit).toBe(25);
      expect(parsed.data.cursor).toBe("abc");
    }
  });

  test("rejects an out-of-range limit", () => {
    expect(
      ZV3ContactAttributeKeyListQuery.safeParse({ workspaceId: "clseedworkspace000000000", limit: 0 }).success
    ).toBe(false);
    expect(
      ZV3ContactAttributeKeyListQuery.safeParse({ workspaceId: "clseedworkspace000000000", limit: 101 })
        .success
    ).toBe(false);
  });
});
