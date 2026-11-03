/**
 * The OAuth scopes a Dashboard viewer may grant an MCP client (ADR-0018, ENG-6889): reading dashboards,
 * plus the identity and refresh scopes every token needs. Whatever else a client asks for is left out,
 * at consent and again by the MCP resource server, so a viewer's token never opens another tool.
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
