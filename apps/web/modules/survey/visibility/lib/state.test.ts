import { describe, expect, test } from "vitest";
import {
  isEffectivelyRestricted,
  isOutboundBlocked,
  isRoleOnlyAccess,
  showVisibilityControls,
  withoutVisibilityControls,
} from "./state";

const manageable = { enforced: true, manageable: true } as const;
const notEntitled = { enforced: true, manageable: false } as const;

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

describe("isOutboundBlocked", () => {
  test("blocks a restricted survey, or one with a change in flight, while enforced", () => {
    expect(isOutboundBlocked(true, { visibility: "restricted" })).toBe(true);
    expect(isOutboundBlocked(true, { visibility: "workspace", pending: "restricted" })).toBe(true);
    expect(isOutboundBlocked(true, { visibility: "workspace" })).toBe(false);
  });

  test("never blocks while not enforced, so the product looks as it did before", () => {
    expect(isOutboundBlocked(false, { visibility: "restricted" })).toBe(false);
    expect(isOutboundBlocked(false, { visibility: "workspace", pending: "restricted" })).toBe(false);
  });
});

describe("showVisibilityControls", () => {
  test("needs both the entitlement and the right to manage visibility", () => {
    expect(showVisibilityControls(manageable, { canManageVisibility: true })).toBe(true);
    expect(showVisibilityControls(manageable, { canManageVisibility: false })).toBe(false);
  });

  test("is off once the entitlement is lost, although restricted surveys stay enforced", () => {
    expect(showVisibilityControls(notEntitled, { canManageVisibility: true })).toBe(false);
  });

  test("is off when access is unknown", () => {
    expect(showVisibilityControls(manageable)).toBe(false);
    expect(showVisibilityControls(manageable, null)).toBe(false);
  });
});

describe("withoutVisibilityControls", () => {
  test("takes the controls away and keeps what is enforced", () => {
    expect(withoutVisibilityControls(manageable)).toEqual(notEntitled);
    expect(withoutVisibilityControls({ enforced: false, manageable: false })).toEqual({
      enforced: false,
      manageable: false,
    });
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
