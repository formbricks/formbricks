import { describe, expect, test } from "vitest";
import { type TRoleEditContext, isRoleEditDisabled } from "./role-edit-rules";

describe("isRoleEditDisabled", () => {
  const context = (overrides: Partial<TRoleEditContext> = {}): TRoleEditContext => ({
    isUserManagementDisabledFromUi: false,
    currentUserRole: "owner",
    memberRole: "member",
    memberId: "target-user",
    userId: "current-user",
    memberAccepted: true,
    doesOrgHaveMoreThanOneOwner: true,
    ...overrides,
  });

  test("disables the sole owner's membership row", () => {
    expect(isRoleEditDisabled(context({ memberRole: "owner", doesOrgHaveMoreThanOneOwner: false }))).toBe(
      true
    );
  });

  test("leaves an owner enabled when the organization has another one", () => {
    expect(isRoleEditDisabled(context({ memberRole: "owner", doesOrgHaveMoreThanOneOwner: true }))).toBe(
      false
    );
  });

  /**
   * The regression guard for ENG-2616: an invite row carries `memberAccepted: undefined`. Its role is
   * changed through `updateInviteAction`, which has no last-owner guard — no membership exists yet — so
   * a single-owner organization must not disable a pending owner invite's dropdown.
   */
  test("leaves a pending owner invite enabled in a single-owner organization", () => {
    expect(
      isRoleEditDisabled(
        context({
          memberRole: "owner",
          memberAccepted: undefined,
          memberId: "",
          doesOrgHaveMoreThanOneOwner: false,
        })
      )
    ).toBe(false);
  });

  test("disables your own row", () => {
    expect(isRoleEditDisabled(context({ memberId: "current-user" }))).toBe(true);
  });

  test("disables an owner's row for a manager", () => {
    expect(isRoleEditDisabled(context({ currentUserRole: "manager", memberRole: "owner" }))).toBe(true);
  });

  test("disables every row when user management is turned off in the UI", () => {
    expect(isRoleEditDisabled(context({ isUserManagementDisabledFromUi: true }))).toBe(true);
  });

  test("leaves an ordinary member enabled", () => {
    expect(isRoleEditDisabled(context())).toBe(false);
  });
});
