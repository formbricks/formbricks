import { describe, expect, test } from "vitest";
import { canAssignOrganizationRole, getAssignableOrganizationRoles } from "./assignable-roles";

describe("getAssignableOrganizationRoles", () => {
  test.each([
    ["owner", true, true, ["dashboard_viewer", "member", "manager", "owner", "billing"]],
    ["owner", false, true, ["dashboard_viewer", "member", "manager", "owner"]],
    ["owner", false, false, ["member", "manager", "owner"]],
    ["manager", false, true, ["dashboard_viewer", "member"]],
    ["manager", true, false, ["member"]],
    ["member", true, true, []],
    ["billing", true, true, []],
    ["dashboard_viewer", true, true, []],
    [undefined, true, true, []],
  ] as const)(
    "a %s (cloud: %s, viewer entitled: %s) may give %j",
    (assignerRole, isFormbricksCloud, isDashboardViewerRoleEnabled, expected) => {
      expect(
        getAssignableOrganizationRoles({ assignerRole, isFormbricksCloud, isDashboardViewerRoleEnabled })
      ).toEqual(expected);
    }
  );
});

describe("canAssignOrganizationRole", () => {
  test("a Manager may make someone a Dashboard viewer exactly as they may make them a Member", () => {
    const context = {
      assignerRole: "manager",
      isFormbricksCloud: false,
      isDashboardViewerRoleEnabled: true,
    } as const;

    expect(canAssignOrganizationRole({ ...context, role: "dashboard_viewer" } as const)).toBe(true);
    expect(canAssignOrganizationRole({ ...context, role: "member" } as const)).toBe(true);
    expect(canAssignOrganizationRole({ ...context, role: "manager" } as const)).toBe(false);
    expect(canAssignOrganizationRole({ ...context, role: "owner" } as const)).toBe(false);
  });

  test("nobody may give the Dashboard viewer role without the entitlement", () => {
    expect(
      canAssignOrganizationRole({
        assignerRole: "owner",
        isFormbricksCloud: true,
        isDashboardViewerRoleEnabled: false,
        role: "dashboard_viewer",
      })
    ).toBe(false);
  });
});
