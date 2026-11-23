import { describe, expect, test } from "vitest";
import {
  uniqueAttributeKey,
  whereAttributeKey,
  whereAttributeKeysOfWorkspace,
  whereAttributeKeysOfWorkspaces,
} from "./attribute-key-scope";

describe("attribute-key-scope", () => {
  test("uniqueAttributeKey targets the key inside the workspace", () => {
    expect(uniqueAttributeKey("ws-1", "userId")).toEqual({
      key_workspaceId: { key: "userId", workspaceId: "ws-1" },
    });
  });

  test("whereAttributeKey filters on both the key and the workspace", () => {
    expect(whereAttributeKey("ws-1", "email")).toEqual({ key: "email", workspaceId: "ws-1" });
  });

  test("whereAttributeKeysOfWorkspace scopes to the workspace and spreads into a wider filter", () => {
    expect(whereAttributeKeysOfWorkspace("ws-1")).toEqual({ workspaceId: "ws-1" });
    expect({ ...whereAttributeKeysOfWorkspace("ws-1"), key: { in: ["plan"] } }).toEqual({
      workspaceId: "ws-1",
      key: { in: ["plan"] },
    });
  });

  test("whereAttributeKeysOfWorkspaces scopes to any of the given workspaces", () => {
    expect(whereAttributeKeysOfWorkspaces(["ws-1", "ws-2"])).toEqual({
      workspaceId: { in: ["ws-1", "ws-2"] },
    });
  });
});
