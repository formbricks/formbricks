import "server-only";
import { TResponseData } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { responses } from "@/app/lib/api/response";
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

/**
 * Applies the email-verification gate to an incoming public response, for both the v1 and v2 endpoints.
 *
 * Single implementation on purpose, mirroring {@link verifyResponseRecaptcha}: the same gate enforced in
 * two places is the drift that let reCAPTCHA end up on one endpoint and not the other. An edit to one
 * copy that missed the other would silently reopen this bypass on one API version.
 *
 * Writes the verified address into `responseData` on success — deliberately taken from the token and
 * never from the request body, so a caller holding a valid token for their own address cannot record
 * someone else's.
 *
 * @returns an error `Response` when the submission must be rejected, otherwise `null`.
 */
export const enforceVerifiedEmailGate = ({
  survey,
  responseData,
  metaUrl,
}: {
  survey: TSurvey;
  responseData: TResponseData;
  metaUrl: string | undefined | null;
}): Response | null => {
  if (!survey.isVerifyEmailEnabled) {
    return null;
  }

  const verifiedEmail = resolveVerifiedEmailFromResponseMeta(survey.id, metaUrl);
  if (!verifiedEmail) {
    return responses.forbiddenResponse("Survey requires email verification", true, {
      surveyId: survey.id,
    });
  }

  responseData[VERIFIED_EMAIL_RESPONSE_KEY] = verifiedEmail;
  return null;
};
