/**
 * How the consent hook (`oauth-grant-revocation.ts`) and Authorized apps' Edit refuse a grant that can't be
 * saved, and the message the consent screen shows for each. Shared by the server and the client screen, so
 * the codes can't drift apart. The grant stays as it was in both cases.
 */

/** 422: the access chosen names an organization or workspace the user can't select. */
export const MCP_GRANT_SELECTION_UNAVAILABLE_CODE = "mcp_grant_selection_unavailable";

/** 500: the grant couldn't be saved, or its narrowing couldn't be applied (after one retry, on consent). */
export const MCP_GRANT_NOT_SAVED_CODE = "mcp_grant_not_saved";

/** The detail a `mcp_grant_not_saved` refusal carries: `auth.oauth.consent_grant_not_saved` in en-US. */
export const MCP_GRANT_NOT_SAVED_DETAIL =
  "The access you chose couldn't be saved, so nothing changed. Try again.";

/** 409: Authorized apps' Edit saved over a grant changed elsewhere since it opened; nothing changed. */
export const MCP_GRANT_CHANGED_CODE = "mcp_grant_changed";

/** The detail a `mcp_grant_changed` refusal carries: `auth.oauth.grant_changed_elsewhere` in en-US. */
export const MCP_GRANT_CHANGED_DETAIL = "This MCP client's access changed elsewhere. Reload to see it.";

/** The message for a refused consent request's error body: the generic failure for any other error. */
export const getConsentErrorMessage = (error: unknown, t: (key: string) => string): string => {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  if (code === MCP_GRANT_SELECTION_UNAVAILABLE_CODE)
    return t("auth.oauth.consent_grant_selection_unavailable");
  if (code === MCP_GRANT_NOT_SAVED_CODE) return t("auth.oauth.consent_grant_not_saved");
  return t("auth.oauth.consent_failed");
};
