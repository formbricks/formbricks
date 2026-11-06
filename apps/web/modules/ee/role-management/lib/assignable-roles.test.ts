import { describe, expect, test } from "vitest";
import { canAssignOrganizationRole, getAssignableOrganizationRoles } from "./assignable-roles";

describe("getAssignableOrganizationRoles", () => {
  test.each([
    ["owner", true, true, ["billing", "owner", "manager", "member", "dashboard_viewer"]],
    ["owner", false, true, ["owner", "manager", "member", "dashboard_viewer"]],
    ["owner", false, false, ["owner", "manager", "member"]],
    ["manager", false, true, ["member", "dashboard_viewer"]],
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

describe("canAssignOrganizationRole on an existing membership", () => {
  const context = { isFormbricksCloud: false, isDashboardViewerRoleEnabled: false } as const;

  test("only an Owner changes an existing Owner's role", () => {
    expect(
      canAssignOrganizationRole({
        ...context,
        assignerRole: "owner",
        role: "member",
        targetCurrentRole: "owner",
      })
    ).toBe(true);
    expect(
      canAssignOrganizationRole({
        ...context,
        assignerRole: "manager",
        role: "member",
        targetCurrentRole: "owner",
      })
    ).toBe(false);
  });

  test("a Manager gives Member to an existing non-owner", () => {
    for (const targetCurrentRole of ["member", "manager", null] as const) {
      expect(
        canAssignOrganizationRole({ ...context, assignerRole: "manager", role: "member", targetCurrentRole })
      ).toBe(true);
    }
  });
});
