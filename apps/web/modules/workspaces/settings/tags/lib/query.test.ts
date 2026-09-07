import { describe, expect, test } from "vitest";
import { tagKeys } from "./query";

describe("tagKeys", () => {
  test("scopes the list key to one workspace", () => {
    expect(tagKeys.list("ws_1")).toEqual(["workspace-tags", "list", "ws_1"]);
  });

  test("the list key starts with the shared base, so `all` invalidates every list", () => {
    // The mutation hooks invalidate `list(workspaceId)`. If that tuple ever stops being prefixed by
    // `all`, a broad invalidation silently stops reaching it and the table goes stale after a write.
    expect(tagKeys.list("ws_1").slice(0, tagKeys.all.length)).toEqual([...tagKeys.all]);
  });

  test("different workspaces get different keys, so one workspace's tags never serve another's", () => {
    expect(tagKeys.list("ws_1")).not.toEqual(tagKeys.list("ws_2"));
  });
});
