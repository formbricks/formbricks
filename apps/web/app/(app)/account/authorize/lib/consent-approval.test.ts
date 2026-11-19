import { describe, expect, test } from "vitest";
import { getConsentApprovalBody, isIdentityOnlyConsent } from "./consent-approval";

const CAP = { surveys: "write", responses: "read" } as const;
const GRANT = { permissions: { surveys: "read" as const }, access: { access: "all" as const } };

describe("isIdentityOnlyConsent", () => {
  test("is a request that asks for no MCP permission", () => {
    expect(isIdentityOnlyConsent({ cap: {}, isDashboardViewer: false })).toBe(true);
    expect(isIdentityOnlyConsent({ cap: CAP, isDashboardViewer: false })).toBe(false);
  });

  // A Dashboard viewer can only approve dashboards:read: the consent endpoint refuses a request without it.
  test("is never a Dashboard viewer's request", () => {
    expect(isIdentityOnlyConsent({ cap: {}, isDashboardViewer: true })).toBe(false);
  });
});

describe("getConsentApprovalBody", () => {
  test("sends the chosen grant, with its access", () => {
    expect(getConsentApprovalBody({ identityOnly: false, grant: GRANT })).toEqual({
      accept: true,
      mcp_grant: { permissions: { surveys: "read" }, access: "all" },
    });
  });

  test("sends a selection's ids, and the scopes to grant when narrower than the request", () => {
    expect(
      getConsentApprovalBody({
        identityOnly: false,
        grantedScope: "openid dashboards:read",
        grant: {
          permissions: { dashboards: "read" },
          access: { access: "workspaces", workspaceIds: ["ws-1"] },
        },
      })
    ).toEqual({
      accept: true,
      scope: "openid dashboards:read",
      mcp_grant: { permissions: { dashboards: "read" }, access: "workspaces", workspaceIds: ["ws-1"] },
    });
  });

  // The consent endpoint refuses a grant that gives nothing; without one it stores the consent alone.
  test("sends no grant for an identity-only request", () => {
    expect(getConsentApprovalBody({ identityOnly: true, grant: { permissions: {} } })).toEqual({
      accept: true,
    });
  });
});
