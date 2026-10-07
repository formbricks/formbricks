import { describe, expect, test } from "vitest";
import { ZV3WorkspaceListQuery } from "./schemas";

describe("ZV3WorkspaceListQuery", () => {
  test("accepts a valid cuid2 workspaceId", () => {
    const result = ZV3WorkspaceListQuery.safeParse({ workspaceId: "clseedworkspace000000000" });
    expect(result.success).toBe(true);
  });

  test("rejects a missing workspaceId", () => {
    expect(ZV3WorkspaceListQuery.safeParse({}).success).toBe(false);
  });

  test("rejects a non-cuid2 workspaceId", () => {
    expect(ZV3WorkspaceListQuery.safeParse({ workspaceId: "not a cuid" }).success).toBe(false);
  });

  test("rejects unknown query keys (strict)", () => {
    const result = ZV3WorkspaceListQuery.safeParse({
      workspaceId: "clseedworkspace000000000",
      sortBy: "name",
    });
    expect(result.success).toBe(false);
  });

  test("defaults, coerces, and accepts limit + cursor", () => {
    const dflt = ZV3WorkspaceListQuery.safeParse({ workspaceId: "clseedworkspace000000000" });
    expect(dflt.success).toBe(true);
    if (dflt.success) expect(dflt.data.limit).toBe(50);

    const parsed = ZV3WorkspaceListQuery.safeParse({
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
      ZV3WorkspaceListQuery.safeParse({ workspaceId: "clseedworkspace000000000", limit: 0 }).success
    ).toBe(false);
    expect(
      ZV3WorkspaceListQuery.safeParse({ workspaceId: "clseedworkspace000000000", limit: 251 }).success
    ).toBe(false);
  });

  /**
   * The accept side of the boundary, asserted against the literal rather than the constant. Every
   * other assertion in this file returns the same result whether the cap is 100 or 250, so without
   * this one the raise is pinned by nothing and reverting it leaves the suite green — while
   * `LimitQuery.yml` still publishes `maximum: 250` to every client.
   */
  test("accepts the documented maximum limit", () => {
    const result = ZV3WorkspaceListQuery.safeParse({
      workspaceId: "clseedworkspace000000000",
      limit: 250,
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(250);
  });
});
