import { describe, expect, test } from "vitest";
import { pickWritableWorkspace } from "./workspace.ts";

const me = (...permissions: [string, string][]) => ({
  data: {
    workspacePermissions: permissions.map(([workspaceId, level]) => ({ workspaceId, permissions: level })),
  },
});

describe("pickWritableWorkspace", () => {
  test("returns the single writable workspace, ignoring read-only ones", () => {
    expect(pickWritableWorkspace(me(["a", "read"], ["b", "write"]))).toBe("b");
  });

  test("treats manage as writable", () => {
    expect(pickWritableWorkspace(me(["a", "manage"]))).toBe("a");
  });

  test("fails when the key can write nowhere", () => {
    expect(() => pickWritableWorkspace(me(["a", "read"]))).toThrow(/no write access/);
  });

  test("fails and asks for FORMBRICKS_WORKSPACE_ID when the key can write to several", () => {
    expect(() => pickWritableWorkspace(me(["a", "write"], ["b", "manage"]))).toThrow(
      /FORMBRICKS_WORKSPACE_ID/
    );
  });

  test("fails on a body without permissions", () => {
    expect(() => pickWritableWorkspace({})).toThrow(/no write access/);
  });
});
