import { type TTranslate, getGrantErrorMessage } from "@/modules/auth/lib/mcp-grant-consent-errors";

/**
 * What a failed Revoke shows: the refusal's code translated, as Edit's Save shows it, or a translated
 * generic failure. Never the server's English detail, nor the browser's ("Failed to fetch") when the
 * request never got an answer.
 */
export const getMcpGrantRevokeFailureMessage = (error: unknown, t: TTranslate): string =>
  getGrantErrorMessage(error, t) ?? t("auth.oauth.grant_revoke_failed");
