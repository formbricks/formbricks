import { describe, expect, test } from "vitest";
import { trimScopesForDashboardViewer } from "./dashboard-viewer-oauth-scopes";
import { MCP_OAUTH_SCOPES } from "./oauth-urls";

describe("trimScopesForDashboardViewer", () => {
  test("keeps dashboards:read and the identity and refresh scopes, and drops every other resource scope", () => {
    expect(trimScopesForDashboardViewer([...MCP_OAUTH_SCOPES])).toEqual([
      "openid",
      "profile",
      "email",
      "offline_access",
      "dashboards:read",
    ]);
  });

  test("never adds a scope the client did not ask for", () => {
    expect(trimScopesForDashboardViewer(["surveys:read", "responses:read"])).toEqual([]);
    expect(trimScopesForDashboardViewer(["dashboards:write", "dashboards:read"])).toEqual([
      "dashboards:read",
    ]);
  });
});
