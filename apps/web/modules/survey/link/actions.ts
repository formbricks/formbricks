"use server";

import { z } from "zod";
import { resolveSurveyLanguage } from "@formbricks/i18n-utils/survey-language-match";
import { ZLinkSurveyEmailData } from "@formbricks/types/email";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { actionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromSurveyId } from "@/lib/utils/helper";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getOrganizationLogoUrl } from "@/modules/ee/whitelabel/email-customization/lib/organization";
import { sendLinkSurveyToVerifiedEmail } from "@/modules/email";
import { getSurveyWithMetadata } from "@/modules/survey/link/lib/data";
import { createLinkSurveyPinToken } from "@/modules/survey/link/lib/pin-token";
import { isLinkSurveyOpenForResponses } from "@/modules/survey/link/lib/public-access";
import { getLinkSurveyCustomCss, omitCustomCssSource } from "@/modules/survey/link/lib/respondent-custom-css";
import { getLinkSurveySingleUseAccess } from "@/modules/survey/link/lib/single-use-link";
import type { TSingleUseLinkSurface } from "@/modules/survey/link/lib/single-use-link-metrics";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";

/**
 * Loads the survey behind one of the link page's public gate actions. Both run without a session, so a
 * survey respondents cannot take right now (a draft, archived, non-link, paused, scheduled or completed
 * one) is "not found" here, before anything else is checked, with the same error as an unknown id. The page
 * shows these as a 404 or as their inactive screen, never their definition (ENG-4032).
 *
 * A single-use survey reached without a valid single-use link is "not found" too, the same way: the page
 * shows it only as "this survey can only be taken by invitation" (ENG-4041). `suId` / `suToken` are the
 * link's raw URL values, which the gate screens pass through.
 */
const getSurveyOpenForResponses = async ({
  surveyId,
  suId,
  suToken,
  surface,
}: {
  surveyId: string;
  suId?: string;
  suToken?: string;
  surface: TSingleUseLinkSurface;
}) => {
  const survey = await getSurveyWithMetadata(surveyId);
  if (
    !isLinkSurveyOpenForResponses(survey) ||
    !getLinkSurveySingleUseAccess({ survey, suId, suToken, surface }).allowed
  ) {
    throw new ResourceNotFoundError("Survey", surveyId);
  }
  return survey;
};

export const sendLinkSurveyEmailAction = actionClient
  .inputSchema(ZLinkSurveyEmailData)
  .action(async ({ parsedInput }) => {
    await applyIPRateLimit(rateLimitConfigs.actions.sendLinkSurveyEmail);

    const survey = await getSurveyOpenForResponses({
      surveyId: parsedInput.surveyId,
      suId: parsedInput.suId,
      suToken: parsedInput.suToken,
      surface: "link_email_action",
    });

    if (!survey.isVerifyEmailEnabled) {
      throw new InvalidInputError("EMAIL_VERIFICATION_NOT_ENABLED");
    }

    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    const organizationLogoUrl = await getOrganizationLogoUrl(organizationId);

    // The language arrives from the client, and it ends up as `?lang=` in the link we email out — so
    // resolve it against this survey's own enabled languages here rather than trusting the payload.
    // Anything that names no enabled language becomes "default" and is left out of the link entirely.
    const surveyLanguageCode =
      resolveSurveyLanguage({
        languages: survey.languages,
        explicitLanguage: parsedInput.surveyLanguageCode,
        unmatchedExplicitLanguage: "fallback",
      }) ?? "default";

    await sendLinkSurveyToVerifiedEmail({
      ...parsedInput,
      surveyLanguageCode,
      logoUrl: organizationLogoUrl || "",
    });
    return { success: true };
  });

const ZValidateSurveyPinAction = z.object({
  surveyId: z.cuid2(),
  pin: z.string(),
  // The single-use link the PIN screen was opened with, as it appears in the URL.
  suId: z.string().optional(),
  suToken: z.string().optional(),
});

export const validateSurveyPinAction = actionClient
  .inputSchema(ZValidateSurveyPinAction)
  .action(async ({ parsedInput }) => {
    await applyIPRateLimit(rateLimitConfigs.actions.validateSurveyPin);

    // Gated before the PIN comparison, so a survey that is not public, or a single-use survey reached without
    // its link, can't be probed for its PIN either.
    const survey = await getSurveyOpenForResponses({
      surveyId: parsedInput.surveyId,
      suId: parsedInput.suId,
      suToken: parsedInput.suToken,
      surface: "link_pin_action",
    });

    const surveyPin = survey.pin;
    const originalPin = surveyPin?.toString();

    if (originalPin && originalPin !== parsedInput.pin) {
      throw new InvalidInputError("INVALID_PIN");
    }

    // The survey goes to the respondent's browser: without its stored custom CSS (editable source),
    // with the compiled CSS the link page would otherwise have rendered (ENG-3552). Resolved only after
    // the PIN matched, so a PIN-protected survey's CSS is not readable before it is unlocked.
    const workspaceContext = await getWorkspaceContextForLinkSurvey(survey.workspaceId);
    const customCss = await getLinkSurveyCustomCss({
      workspaceCustomCss: workspaceContext.customCss,
      allowStyleOverwrite: workspaceContext.workspace.styling?.allowStyleOverwrite,
      survey,
    });
    // Without the PIN, like the survey the renderer hands out: the respondent just typed it, but the two
    // paths should never disagree about what leaves the server.
    const publicSurvey = { ...omitCustomCssSource(survey), pin: null };

    if (!originalPin) return { survey: publicSurvey, customCss };
    return { survey: publicSurvey, customCss, pinAuthToken: createLinkSurveyPinToken(survey.id) };
  });
