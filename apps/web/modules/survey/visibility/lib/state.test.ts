import { describe, expect, test } from "vitest";
import { isEffectivelyRestricted, isRoleOnlyAccess, showVisibilityControls } from "./state";

describe("isEffectivelyRestricted", () => {
  test.each([
    [{ visibility: "restricted" as const }, true],
    [{ visibility: "workspace" as const }, false],
    [{ visibility: "workspace" as const, pending: null }, false],
    [{ visibility: "workspace" as const, pending: "restricted" as const }, true],
    [{ visibility: "workspace" as const, pending: "workspace" as const }, true],
    [{ visibility: "restricted" as const, pending: "workspace" as const }, true],
  ])("%o → %s", (state, expected) => {
    expect(isEffectivelyRestricted(state)).toBe(expected);
  });
});

describe("showVisibilityControls", () => {
  test("needs both the gate and the right to manage visibility", () => {
    expect(showVisibilityControls(true, { canManageVisibility: true })).toBe(true);
    expect(showVisibilityControls(false, { canManageVisibility: true })).toBe(false);
    expect(showVisibilityControls(true, { canManageVisibility: false })).toBe(false);
  });

  test("is off when access is unknown", () => {
    expect(showVisibilityControls(true)).toBe(false);
    expect(showVisibilityControls(true, null)).toBe(false);
  });
});

describe("isRoleOnlyAccess", () => {
  test.each([
    [{ via: "organizationRole" }, true],
    [{ via: "owner" }, false],
    [{ via: "workspace" }, false],
    [undefined, false],
    [null, false],
  ])("%o → %s", (access, expected) => {
    expect(isRoleOnlyAccess(access)).toBe(expected);
  });
});
