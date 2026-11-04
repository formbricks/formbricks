import { describe, expect, test } from "vitest";
import { getOrganizationSwitchPath } from "./organization-switch";

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
