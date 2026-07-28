import "server-only";
import { verifyTokenForLinkSurvey } from "@/lib/jwt";

export const VERIFIED_EMAIL_RESPONSE_KEY = "verifiedEmail";

/**
 * Server-side enforcement of a link survey's `isVerifyEmailEnabled` setting.
 *
 * The gate used to live only in the page renderer (`survey-renderer.tsx` refuses to mount the survey
 * unless `?verify=<token>` resolves), which is a client-side-only control: the response endpoints are
 * public, so a caller could POST straight to `/api/v{1,2}/client/{workspaceId}/responses` with
 * `data.verifiedEmail` set to any address and never present a token. That is the same defect already
 * fixed for PIN-protected surveys (see `verifyLinkSurveyPinToken`, CWE-602 / ENG-1579).
 *
 * The token is read from `meta.url` rather than a new request field so no widget or bundle change is
 * needed — the survey client already sends `window.location.href`, which for a link survey is the
 * `/s/<surveyId>?verify=…` URL. `meta.url` is attacker-controlled, but the token inside it is a
 * signed, survey-bound JWT, so control of the URL does not help. The v2 endpoint already trusts this
 * same channel for `suId`/`suToken` single-use validation.
 *
 * @returns the verified email address, or `null` when no valid token for this survey was presented.
 */
export const resolveVerifiedEmailFromResponseMeta = (
  surveyId: string,
  metaUrl: string | undefined | null
): string | null => {
  if (!metaUrl) {
    return null;
  }

  let token: string | null;
  try {
    token = new URL(metaUrl).searchParams.get("verify");
  } catch {
    return null;
  }

  if (!token) {
    return null;
  }

  return verifyTokenForLinkSurvey(token, surveyId);
};
