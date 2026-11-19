import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  MCP_GRANT_BEYOND_SCOPES_CODE,
  MCP_GRANT_CHANGED_CODE,
  MCP_GRANT_SELECTION_UNAVAILABLE_CODE,
  type TTranslate,
  getGrantErrorMessage,
} from "@/modules/auth/lib/mcp-grant-consent-errors";
import type { TMcpGrantAccessSelection, TMcpGrantPermissions } from "@/modules/mcp/grant";
import { initialMcpGrantAccessDraft } from "@/modules/mcp/grant-access";
import type { TMcpGrantDraft, TMcpSavedGrant } from "@/modules/mcp/grant-draft";
import { getInitialMcpGrantPermissions } from "@/modules/mcp/grant-editor";

/**
 * Authorized apps' Edit (ENG-7152), the logic behind its dialog: what it opens with and what a refused Save
 * does. Pure, so it is unit-tested here rather than through the component.
 */

/** What Edit opens on, captured once when the dialog mounts. */
export type TMcpGrantEditOpening = {
  /** The draft the matrix and access picker start from. */
  initial: TMcpGrantDraft;
  /** What the draft is compared against: Save stays disabled until it differs. */
  saved: TMcpSavedGrant;
  /** The grant version Save sends: a grant saved elsewhere since is not overwritten (409). */
  expectedUpdatedAt: string;
};

/**
 * Opens Edit on a client's grant. The permissions are held to the client's cap first: scopes can narrow
 * after a save (`/oauth2/update-consent`, or the user becoming a Dashboard viewer), and a draft that kept a
 * level the matrix hides would make every save, an access-only one included, a `beyond_scopes` refusal.
 * The token's scopes already cap the stored grant on every call, so the clamped draft is what the client
 * holds now, and it is also what an unchanged draft is compared against.
 *
 * The version is captured here too, not read from the live client at Save: the list refetches while the
 * dialog is open, and a newer version would let a stale draft pass the 409 check.
 */
export const openMcpGrantEdit = (client: {
  permissions: TMcpGrantPermissions;
  access: TMcpGrantAccessSelection;
  cap: TMcpGrantPermissions;
  grantUpdatedAt: string;
}): TMcpGrantEditOpening => {
  const permissions = getInitialMcpGrantPermissions({ existing: client.permissions, cap: client.cap });
  return {
    initial: { permissions, access: initialMcpGrantAccessDraft(client.access) },
    saved: { permissions, access: client.access },
    expectedUpdatedAt: client.grantUpdatedAt,
  };
};

/**
 * Refusals that mean the dialog was opened on something that has since changed: the grant (409), the
 * client's scopes (`beyond_scopes`), or what the user may select (`selection_unavailable`). None can be
 * fixed inside the open dialog, so the list is refreshed and the dialog closes; Edit opens again on what
 * is true now.
 */
const STALE_EDIT_CODES: ReadonlySet<string> = new Set([
  MCP_GRANT_CHANGED_CODE,
  MCP_GRANT_BEYOND_SCOPES_CODE,
  MCP_GRANT_SELECTION_UNAVAILABLE_CODE,
]);

export const isStaleMcpGrantEditError = (error: unknown): boolean =>
  error instanceof V3ApiError && error.code !== undefined && STALE_EDIT_CODES.has(error.code);

/**
 * What a refused Save shows and whether the dialog closes: the refusal's code translated (never the
 * server's English detail), or the generic failure; closed for a stale-edit refusal.
 */
export const getMcpGrantSaveFailure = (
  error: unknown,
  t: TTranslate
): { message: string; closeDialog: boolean } => ({
  message: getGrantErrorMessage(error, t) ?? t("auth.oauth.grant_update_failed"),
  closeDialog: isStaleMcpGrantEditError(error),
});

/**
 * Whether an Escape the dialog sees belongs to an open organization or workspace picker. The picker
 * (`MultiSelect`, a cmdk combobox) is open while its input has focus and closes on Escape by blurring it;
 * the dialog listens for Escape on the whole document, so without this the same key press also closed
 * Edit and threw the draft away. The dialog ignores such an Escape, and the next one, with the picker
 * closed, closes it.
 */
export const isEscapeForOpenPicker = (target: EventTarget | null): boolean =>
  typeof Element !== "undefined" &&
  target instanceof Element &&
  target.matches("input") &&
  target.closest("[cmdk-root]") !== null;
