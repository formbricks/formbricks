import "server-only";
import { resolveSurveyLanguage } from "@formbricks/i18n-utils/survey-language-match";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { applyIPRateLimitOrRespond, rateLimitedResponse } from "@/app/api/v3/lib/operation-rate-limit";
import { noContentResponse, problemNotFound, problemUnprocessableContent } from "@/app/api/v3/lib/response";
import { getOrganizationIdFromSurveyId } from "@/lib/utils/helper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getOrganizationLogoUrl } from "@/modules/ee/whitelabel/email-customization/lib/organization";
import { sendLinkSurveyToVerifiedEmail } from "@/modules/email";
import { resolveEmailActorUserId } from "@/modules/email/lib/email-actor";
import { getSurveyOwnerId } from "@/modules/survey/link/lib/data";
import { getLinkSurveyOpenForResponses } from "@/modules/survey/link/lib/open-for-responses";
import type { TLinkSurveyVerificationEmailBody } from "../schemas";

type TRequestContext = { requestId: string; instance?: string };

/** The code the verify-email screen shows when the survey no longer asks for email verification. */
export const EMAIL_VERIFICATION_NOT_ENABLED = "EMAIL_VERIFICATION_NOT_ENABLED";

/**
 * `POST /api/internal/link-survey-verification-emails`: email the respondent the survey's verified link.
 * Charged to the client's IP (10 an hour, fail-closed), then to the survey's organization and owner through
 * the email caps in `sendEmail`. A survey that is not open to this caller answers 404, the same for every
 * reason (see `getLinkSurveyOpenForResponses`), which the page takes as "re-render". 204 once sent.
 */
export async function sendLinkSurveyVerificationEmailOperation({
  body,
  ...context
}: TRequestContext & { body: TLinkSurveyVerificationEmailBody }): Promise<Response> {
  const { requestId, instance } = context;
  const limited = await applyIPRateLimitOrRespond(rateLimitConfigs.actions.sendLinkSurveyEmail, context);
  if (limited) return limited;

  const survey = await getLinkSurveyOpenForResponses({
    surveyId: body.surveyId,
    suId: body.suId,
    suToken: body.suToken,
    surface: "link_email_action",
  });
  if (!survey) return problemNotFound(requestId, "Survey", body.surveyId, instance);

  if (!survey.isVerifyEmailEnabled) {
    return problemUnprocessableContent(requestId, EMAIL_VERIFICATION_NOT_ENABLED, {
      instance,
      details: { reason: EMAIL_VERIFICATION_NOT_ENABLED },
    });
  }

  const [organizationId, surveyOwnerId] = await Promise.all([
    getOrganizationIdFromSurveyId(body.surveyId),
    getSurveyOwnerId(body.surveyId),
  ]);
  // Independent reads on the hot path of an unauthenticated route: run them together. `ownerId` stays out
  // of the survey the page loads, which reaches the browser, so it is read here instead.
  const [organizationLogoUrl, actorUserId] = await Promise.all([
    getOrganizationLogoUrl(organizationId),
    resolveEmailActorUserId(surveyOwnerId, organizationId),
  ]);

  // The language arrives from the client, and it ends up as `?lang=` in the link we email out — so
  // resolve it against this survey's own enabled languages here rather than trusting the payload.
  // Anything that names no enabled language becomes "default" and is left out of the link entirely.
  const surveyLanguageCode =
    resolveSurveyLanguage({
      languages: survey.languages,
      explicitLanguage: body.surveyLanguageCode,
      unmatchedExplicitLanguage: "fallback",
    }) ?? "default";

  // The name and logo come from the stored survey and its organization, never the request: a caller
  // could otherwise put text of their choosing into an email sent from this instance (ENG-4043). The
  // single-use link values ride along only for a survey that uses them, where the gate above checked them.
  const isSingleUse = survey.singleUse?.enabled === true;
  try {
    await sendLinkSurveyToVerifiedEmail(
      {
        surveyId: body.surveyId,
        email: body.email,
        locale: body.locale,
        suId: isSingleUse ? body.suId : undefined,
        suToken: isSingleUse ? body.suToken : undefined,
        surveyLanguageCode,
        surveyName: survey.name,
        logoUrl: organizationLogoUrl || "",
      },
      // The visitor is anonymous, so the survey's organization and owner carry the limits: a fresh
      // survey or organization does not reset them.
      { organizationId, actorUserId, externalRecipient: true }
    );
  } catch (error) {
    // A spent email cap is the respondent's answer, with the cap's own message, as the action gave it.
    if (error instanceof TooManyRequestsError) return rateLimitedResponse(error, context);
    throw error;
  }
  return noContentResponse({ requestId });
}
