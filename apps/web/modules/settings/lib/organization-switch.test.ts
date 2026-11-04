import { describe, expect, test } from "vitest";
import { getOrganizationSwitchPath, getWorkspaceHomePath } from "./organization-switch";

describe("getOrganizationSwitchPath", () => {
  test("picking the current organization opens its settings", () => {
    expect(
      getOrganizationSwitchPath({
        organizationId: "org1",
        currentOrganizationId: "org1",
        membershipRole: "owner",
      })
    ).toBe("/organizations/org1/settings/general");
  });

  test("picking another organization goes through its redirect route, whatever the role", () => {
    for (const membershipRole of ["owner", "member", "dashboard_viewer", undefined] as const) {
      expect(
        getOrganizationSwitchPath({ organizationId: "org2", currentOrganizationId: "org1", membershipRole })
      ).toBe("/organizations/org2/");
    }
  });

  test("a Dashboard viewer has no organization settings, so the current organization redirects too (U16)", () => {
    expect(
      getOrganizationSwitchPath({
        organizationId: "org1",
        currentOrganizationId: "org1",
        membershipRole: "dashboard_viewer",
      })
    ).toBe("/organizations/org1/");
  });
});

describe("getWorkspaceHomePath", () => {
  test("a Dashboard viewer's workspace home is its dashboard list", () => {
    expect(getWorkspaceHomePath("dashboard_viewer", "ws1")).toBe("/workspaces/ws1/dashboards");
  });

  test("a Billing member goes through the workspace route, which sends it to billing", () => {
    expect(getWorkspaceHomePath("billing", "ws1")).toBe("/workspaces/ws1/");
  });

  test("everyone else lands on the surveys", () => {
    for (const role of ["owner", "manager", "member", undefined] as const) {
      expect(getWorkspaceHomePath(role, "ws1")).toBe("/workspaces/ws1/surveys");
    }
  });
});
