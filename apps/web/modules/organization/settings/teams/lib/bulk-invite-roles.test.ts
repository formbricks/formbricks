import { describe, expect, test } from "vitest";
import { ZInvitees } from "@/modules/organization/settings/teams/types/invites";
import { findRefusedBulkInviteRoles, parseRoleCell } from "./bulk-invite-roles";

describe("parseRoleCell", () => {
  test.each([
    ["dashboard_viewer", "dashboard_viewer"],
    ["Dashboard viewer", "dashboard_viewer"],
    ["  DASHBOARD   VIEWER ", "dashboard_viewer"],
    ["Member", "member"],
    ["", ""],
  ])("reads %j as %j", (cell, expected) => {
    expect(parseRoleCell(cell, true)).toBe(expected);
  });

  test("invites everyone as an owner without Access Control, as before", () => {
    expect(parseRoleCell("dashboard_viewer", false)).toBe("owner");
  });

  test("a parsed Dashboard viewer row passes the invite schema", () => {
    const parsed = ZInvitees.safeParse([
      { name: "Ada", email: "ada@example.com", role: parseRoleCell("Dashboard viewer", true), teamIds: [] },
    ]);
    expect(parsed.success).toBe(true);
  });
});

describe("findRefusedBulkInviteRoles", () => {
  const row = (email: string, role: string) => ({ email, role });

  test("an empty file refuses nothing", () => {
    expect(
      findRefusedBulkInviteRoles([], {
        assignerRole: "owner",
        isFormbricksCloud: true,
        isDashboardViewerRoleEnabled: true,
      })
    ).toEqual({ billing: [], dashboardViewer: [], other: [] });
  });

  test("an owner on Cloud with the entitlement may give every role", () => {
    const rows = ["owner", "manager", "member", "billing", "dashboard_viewer"].map((role, index) =>
      row(`u${index}@example.com`, role)
    );
    expect(
      findRefusedBulkInviteRoles(rows, {
        assignerRole: "owner",
        isFormbricksCloud: true,
        isDashboardViewerRoleEnabled: true,
      })
    ).toEqual({ billing: [], dashboardViewer: [], other: [] });
  });

  test("Billing off Cloud and a viewer without the entitlement are named by email", () => {
    expect(
      findRefusedBulkInviteRoles(
        [row("b@example.com", "billing"), row("v@example.com", "dashboard_viewer")],
        {
          assignerRole: "owner",
          isFormbricksCloud: false,
          isDashboardViewerRoleEnabled: false,
        }
      )
    ).toEqual({ billing: ["b@example.com"], dashboardViewer: ["v@example.com"], other: [] });
  });

  test("a Manager's rows are checked by the same rule the picker uses", () => {
    expect(
      findRefusedBulkInviteRoles(
        [row("o@example.com", "owner"), row("m@example.com", "member"), row("x@example.com", "manager")],
        { assignerRole: "manager", isFormbricksCloud: true, isDashboardViewerRoleEnabled: true }
      )
    ).toEqual({ billing: [], dashboardViewer: [], other: ["o@example.com", "x@example.com"] });
  });

  test("a role the enum does not know is left to schema validation", () => {
    expect(
      findRefusedBulkInviteRoles([row("z@example.com", "admin")], {
        assignerRole: "owner",
        isFormbricksCloud: true,
        isDashboardViewerRoleEnabled: true,
      })
    ).toEqual({ billing: [], dashboardViewer: [], other: [] });
  });

  test("a thousand rows are checked in one pass", () => {
    const rows = Array.from({ length: 1000 }, (_, index) => row(`u${index}@example.com`, "manager"));
    const refused = findRefusedBulkInviteRoles(rows, {
      assignerRole: "manager",
      isFormbricksCloud: false,
      isDashboardViewerRoleEnabled: false,
    });
    expect(refused.other).toHaveLength(1000);
  });
});
