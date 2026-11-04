/**
 * The OAuth scopes a Dashboard viewer may grant an MCP client (ADR-0023): reading dashboards, plus the
 * identity and refresh scopes every token needs. Whatever else a client asks for is left out, in three
 * places: at consent (`dashboard-viewer-oauth-consent.ts`), by the MCP resource server on every request
 * (`modules/mcp/auth.ts`), and by revoking the grants of a user whose last other role is removed.
 *
 * All three apply to a user who is a Dashboard viewer in every organization they belong to. A user who
 * is a viewer in one organization and holds another role elsewhere keeps the scopes they grant: the
 * scope cannot say which organization a call is for, and SpiceDB, asked by each operation, refuses them
 * everything but dashboard reads in the viewer organization.
 */
export const DASHBOARD_VIEWER_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "dashboards:read",
] as const;

const ALLOWED = new Set<string>(DASHBOARD_VIEWER_OAUTH_SCOPES);

/** `scopes` without anything a Dashboard viewer may not grant, in their original order. */
export const trimScopesForDashboardViewer = (scopes: ReadonlyArray<string>): string[] =>
  scopes.filter((scope) => ALLOWED.has(scope));
