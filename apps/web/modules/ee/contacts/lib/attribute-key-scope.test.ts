import { describe, expect, test } from "vitest";
import {
  uniqueAttributeKey,
  whereAttributeKey,
  whereAttributeKeysOfDirectory,
  whereAttributeKeysOfWorkspace,
  whereAttributeKeysOfWorkspaces,
  whereDirectoryAttributeKey,
} from "./attribute-key-scope";

describe("attribute-key-scope", () => {
  test("uniqueAttributeKey targets the key inside the directory", () => {
    expect(uniqueAttributeKey("dir-1", "userId")).toEqual({
      directoryId_key: { directoryId: "dir-1", key: "userId" },
    });
  });

  test("whereDirectoryAttributeKey filters on the key and the directory", () => {
    expect(whereDirectoryAttributeKey("dir-1", "email")).toEqual({ key: "email", directoryId: "dir-1" });
  });

  test("whereAttributeKeysOfDirectory scopes to the directory and spreads into a wider filter", () => {
    expect({ ...whereAttributeKeysOfDirectory("dir-1"), key: { in: ["plan"] } }).toEqual({
      directoryId: "dir-1",
      key: { in: ["plan"] },
    });
  });

  // Keys belong to the directory, so a key another workspace of a shared directory created (or a default
  // key with no workspace at all) is still the workspace's key.
  test("whereAttributeKey finds the key in the workspace's directory, not by its origin workspace", () => {
    expect(whereAttributeKey("ws-1", "email")).toEqual({
      key: "email",
      directory: { workspaces: { some: { id: "ws-1" } } },
    });
  });

  test("whereAttributeKeysOfWorkspace scopes to the workspace's directory and spreads into a wider filter", () => {
    expect({ ...whereAttributeKeysOfWorkspace("ws-1"), key: { in: ["plan"] } }).toEqual({
      directory: { workspaces: { some: { id: "ws-1" } } },
      key: { in: ["plan"] },
    });
  });

  test("whereAttributeKeysOfWorkspaces scopes to the directories of any of the given workspaces", () => {
    expect(whereAttributeKeysOfWorkspaces(["ws-1", "ws-2"])).toEqual({
      directory: { workspaces: { some: { id: { in: ["ws-1", "ws-2"] } } } },
    });
  });
});
