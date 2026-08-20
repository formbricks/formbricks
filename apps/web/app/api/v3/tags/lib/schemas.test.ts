import { describe, expect, test } from "vitest";
import { ZV3MergeTagBody, ZV3RenameTagBody, ZV3TagIdParams, ZV3TagListQuery } from "./schemas";

describe("ZV3RenameTagBody", () => {
  test("trims the name, so a padded rename does not store its whitespace", () => {
    expect(ZV3RenameTagBody.parse({ name: "  Bug report  " })).toEqual({ name: "Bug report" });
  });

  test("rejects a name that is empty once trimmed", () => {
    // The old server action took a bare string and relied on the component trimming first, so a
    // whitespace-only rename could store an unnamed tag. Rejecting here makes that a 422.
    expect(ZV3RenameTagBody.safeParse({ name: "   " }).success).toBe(false);
    expect(ZV3RenameTagBody.safeParse({ name: "" }).success).toBe(false);
  });

  test("rejects a name past 255 characters but accepts one exactly at the limit", () => {
    expect(ZV3RenameTagBody.safeParse({ name: "a".repeat(255) }).success).toBe(true);
    expect(ZV3RenameTagBody.safeParse({ name: "a".repeat(256) }).success).toBe(false);
  });

  test("rejects unknown keys rather than ignoring them", () => {
    expect(ZV3RenameTagBody.safeParse({ name: "Bug report", workspaceId: "cl000" }).success).toBe(false);
  });
});

describe("id schemas", () => {
  const id = "clxx1234567890123456789012";

  test("accept a well-formed id", () => {
    expect(ZV3TagIdParams.parse({ tagId: id })).toEqual({ tagId: id });
    expect(ZV3TagListQuery.parse({ workspaceId: id })).toEqual({ workspaceId: id });
    expect(ZV3MergeTagBody.parse({ newTagId: id })).toEqual({ newTagId: id });
  });

  test("reject an id that is not a cuid", () => {
    expect(ZV3TagIdParams.safeParse({ tagId: "not a cuid" }).success).toBe(false);
    expect(ZV3TagListQuery.safeParse({ workspaceId: "" }).success).toBe(false);
    expect(ZV3MergeTagBody.safeParse({ newTagId: "tag_ABC" }).success).toBe(false);
  });

  test("the merge body carries only the target id, so the workspace cannot be supplied by the caller", () => {
    expect(ZV3MergeTagBody.safeParse({ newTagId: id, workspaceId: id }).success).toBe(false);
  });
});
