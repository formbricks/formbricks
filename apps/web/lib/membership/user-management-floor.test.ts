import { beforeEach, describe, expect, test, vi } from "vitest";
import { canInviteMembers, canTeamAdminInvite, isUserManagementDisabled } from "./user-management-floor";

const constants = vi.hoisted(() => ({ userManagementMinimumRole: "manager" }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/constants", () => ({
  get USER_MANAGEMENT_MINIMUM_ROLE() {
    return constants.userManagementMinimumRole;
  },
}));

beforeEach(() => {
  constants.userManagementMinimumRole = "manager";
});

describe("isUserManagementDisabled", () => {
  test.each([
    ["disabled", true],
    ["owner", false],
    ["manager", false],
  ])("is %s → %s", (floor, expected) => {
    constants.userManagementMinimumRole = floor;

    expect(isUserManagementDisabled()).toBe(expected);
  });
});

describe("canTeamAdminInvite", () => {
  test.each(["owner", "manager"])("lets a licensed team admin invite at the %s floor", (floor) => {
    constants.userManagementMinimumRole = floor;

    expect(canTeamAdminInvite({ isAccessControlAllowed: true, isTeamAdmin: true })).toBe(true);
  });

  // ENG-7376: `disabled` switches user management off for team admins too.
  test("refuses a licensed team admin while user management is disabled", () => {
    constants.userManagementMinimumRole = "disabled";

    expect(canTeamAdminInvite({ isAccessControlAllowed: true, isTeamAdmin: true })).toBe(false);
  });

  test.each([
    ["without the Access Control licence", { isAccessControlAllowed: false, isTeamAdmin: true }],
    ["who administers no team", { isAccessControlAllowed: true, isTeamAdmin: false }],
  ])("refuses a member %s", (_label, input) => {
    expect(canTeamAdminInvite(input)).toBe(false);
  });
});

describe("canInviteMembers", () => {
  const teamAdmin = {
    isOwnerOrManager: false,
    canManageUsers: false,
    isAccessControlAllowed: true,
    isTeamAdmin: true,
  };

  test.each([true, false])("follows the floor's answer for an owner or manager (%s)", (canManageUsers) => {
    constants.userManagementMinimumRole = "disabled";

    expect(
      canInviteMembers({
        isOwnerOrManager: true,
        canManageUsers,
        isAccessControlAllowed: true,
        isTeamAdmin: true,
      })
    ).toBe(canManageUsers);
  });

  test("lets a team admin invite above the floor and not at `disabled`", () => {
    expect(canInviteMembers(teamAdmin)).toBe(true);

    constants.userManagementMinimumRole = "disabled";

    expect(canInviteMembers(teamAdmin)).toBe(false);
  });

  // An owner or manager is decided by the floor alone, even when they also administer a team: at the `owner`
  // floor a manager is refused by the route, so the button must not appear through the team-admin path.
  test("does not let a manager below the floor invite through the team-admin path", () => {
    constants.userManagementMinimumRole = "owner";

    expect(canInviteMembers({ ...teamAdmin, isOwnerOrManager: true, canManageUsers: false })).toBe(false);
  });

  test("never lets a member who administers no team invite", () => {
    expect(canInviteMembers({ ...teamAdmin, isTeamAdmin: false })).toBe(false);
  });
});
