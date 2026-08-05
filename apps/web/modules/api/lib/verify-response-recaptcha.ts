import "server-only";
import { logger } from "@formbricks/logger";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getOrganizationBillingByWorkspaceId } from "@/app/api/v2/client/[workspaceId]/responses/lib/organization";
import { verifyRecaptchaToken } from "@/app/api/v2/client/[workspaceId]/responses/lib/recaptcha";
import { responses } from "@/app/lib/api/response";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";

export const RECAPTCHA_VERIFICATION_ERROR_CODE = "recaptcha_verification_failed";

/**
 * Shared reCAPTCHA gate for the public response-submission endpoints.
 *
 * This lives in one place on purpose: the check was originally implemented only inside the v2
 * endpoint's `checkSurveyValidity`, while `POST /api/v1/client/{workspaceId}/responses` accepts
 * responses for the same surveys with no reCAPTCHA check at all. Both endpoints are public and
 * unauthenticated, so a caller could opt out of a survey's spam protection just by posting to the v1
 * URL. Keeping a single implementation is what stops the two versions drifting apart again.
 *
 * @returns an error `Response` when the request must be rejected, otherwise `null`.
 */
export const verifyResponseRecaptcha = async ({
  survey,
  workspaceId,
  recaptchaToken,
}: {
  survey: TSurvey;
  workspaceId: string;
  recaptchaToken?: string | null;
}): Promise<Response | null> => {
  if (!survey.recaptcha?.enabled) {
    return null;
  }

  if (!recaptchaToken) {
    // warn, not error: a public endpoint receiving a request without a token is an ordinary
    // caller-controlled condition, not an application fault, and erroring on it lets anyone fill the
    // error log by posting an empty body.
    logger.warn("Missing recaptcha token");
    return responses.badRequestResponse(
      "Missing recaptcha token",
      { code: RECAPTCHA_VERIFICATION_ERROR_CODE },
      true
    );
  }

  const billing = await getOrganizationBillingByWorkspaceId(workspaceId);
  if (!billing) {
    // `cors: true` to match every other response this function returns. `notFoundResponse` defaults it
    // to false, so without it this one branch of a public, browser-called endpoint would answer without
    // the CORS headers and surface to the respondent as an opaque network error instead of a 404.
    return responses.notFoundResponse("Organization", null, true);
  }

  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
  const isSpamProtectionEnabled = await getIsSpamProtectionEnabled(organizationId);
  if (!isSpamProtectionEnabled) {
    // Deliberately does not gate: the token is still verified below, so an organization without the
    // entitlement gets the stricter behaviour, not a bypass. Logged at warn because it reports a
    // licensing state an operator may want to see, not a fault. (Ported as-is from the v2 endpoint;
    // making it fail-open here would silently drop reCAPTCHA for unentitled organizations.)
    logger.warn("Spam protection is not enabled for this organization");
  }

  const isPassed = await verifyRecaptchaToken(recaptchaToken, survey.recaptcha.threshold);
  if (!isPassed) {
    return responses.badRequestResponse(
      "reCAPTCHA verification failed",
      { code: RECAPTCHA_VERIFICATION_ERROR_CODE },
      true
    );
  }

  return null;
};
