/**
 * How the consent hook (`oauth-grant-revocation.ts`), the internal grants route (`api/internal/mcp-grants`)
 * and Authorized apps' Edit refuse a grant that can't be saved, and the message the consent screen and Edit
 * show for each. Shared by the server and the client, so the codes can't drift apart: a refusal carries one
 * of these codes, and the screens translate the code rather than showing the server's English detail. The
 * grant stays as it was in every case.
 */

/** 422, on Edit and on consent alike: the access chosen names an organization or workspace the user can't select. */
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

/**
 * 422 (Edit) / 400 (consent): the grant names permissions the client's scopes don't ask for. Edit sees it
 * when its draft was opened against scopes that have since narrowed; the consent screen, only from a
 * hand-made request, since the matrix never offers above the cap.
 */
export const MCP_GRANT_BEYOND_SCOPES_CODE = "mcp_grant_beyond_scopes";

/** The detail a `mcp_grant_beyond_scopes` refusal carries: `auth.oauth.grant_beyond_scopes` in en-US. */
export const MCP_GRANT_BEYOND_SCOPES_DETAIL = "The grant names access this client didn't ask for.";

/**
 * 400: the request's grant can't be read at all — unknown field or permission, a level the permission
 * doesn't offer, a grant that gives nothing, or a selection with nothing picked. Neither screen sends one;
 * a selection over the limit is held back on the screen itself, with its own hint (`grant-access.ts`).
 */
export const MCP_GRANT_INVALID_CODE = "mcp_grant_invalid";

/** The detail a `mcp_grant_invalid` refusal carries: `auth.oauth.grant_invalid` in en-US. */
export const MCP_GRANT_INVALID_DETAIL =
  "The grant must give at least one permission at a level it offers, and pick at least one organization or workspace when its access selects them.";

/** The `t` these messages are translated with. */
export type TTranslate = (key: string, values?: Record<string, string>) => string;

/**
 * The message each refusal code shows, so neither screen reads the server's English detail. Each entry takes
 * `t` rather than naming a key, so the literals stay visible to the translation scanner.
 */
const MESSAGES: Readonly<Record<string, (t: TTranslate) => string>> = {
  [MCP_GRANT_SELECTION_UNAVAILABLE_CODE]: (t) => t("auth.oauth.consent_grant_selection_unavailable"),
  [MCP_GRANT_NOT_SAVED_CODE]: (t) => t("auth.oauth.consent_grant_not_saved"),
  [MCP_GRANT_CHANGED_CODE]: (t) => t("auth.oauth.grant_changed_elsewhere"),
  [MCP_GRANT_BEYOND_SCOPES_CODE]: (t) => t("auth.oauth.grant_beyond_scopes"),
  [MCP_GRANT_INVALID_CODE]: (t) => t("auth.oauth.grant_invalid"),
};

/**
 * The translated message for a refused grant save, from the refusal's `code`; `null` for anything else, so
 * the caller shows its own fallback.
 */
export const getGrantErrorMessage = (error: unknown, t: TTranslate): string | null => {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const { code } = error;
  // Own keys only: a code such as `toString` must not reach the object's prototype.
  return typeof code === "string" && Object.hasOwn(MESSAGES, code) ? MESSAGES[code](t) : null;
};
