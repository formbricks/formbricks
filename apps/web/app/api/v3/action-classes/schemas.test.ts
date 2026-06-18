import { describe, expect, test } from "vitest";
import { ZV3ActionClassListQuery } from "./schemas";

describe("ZV3ActionClassListQuery", () => {
  test("accepts a valid cuid2 workspaceId", () => {
    const result = ZV3ActionClassListQuery.safeParse({ workspaceId: "clseedworkspace000000000" });
    expect(result.success).toBe(true);
  });

  test("rejects a missing workspaceId", () => {
    expect(ZV3ActionClassListQuery.safeParse({}).success).toBe(false);
  });

  test("rejects a non-cuid2 workspaceId", () => {
    expect(ZV3ActionClassListQuery.safeParse({ workspaceId: "not a cuid" }).success).toBe(false);
  });

  test("rejects unknown query keys (strict)", () => {
    const result = ZV3ActionClassListQuery.safeParse({
      workspaceId: "clseedworkspace000000000",
      limit: "10",
    });
    expect(result.success).toBe(false);
  });
});
