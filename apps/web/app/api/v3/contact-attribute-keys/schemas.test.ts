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
      cursor: "abc",
    });
    expect(result.success).toBe(false);
  });
});
