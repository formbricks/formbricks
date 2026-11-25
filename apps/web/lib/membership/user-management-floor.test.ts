import { beforeEach, describe, expect, test, vi } from "vitest";
import { canTeamAdminInvite, isUserManagementDisabled } from "./user-management-floor";

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
