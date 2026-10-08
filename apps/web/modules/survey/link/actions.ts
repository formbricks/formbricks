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
import { getLinkSurveyCustomCss, omitCustomCssSource } from "@/modules/survey/link/lib/respondent-custom-css";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";

export const sendLinkSurveyEmailAction = actionClient
  .inputSchema(ZLinkSurveyEmailData)
  .action(async ({ parsedInput }) => {
    await applyIPRateLimit(rateLimitConfigs.actions.sendLinkSurveyEmail);

    const survey = await getSurveyWithMetadata(parsedInput.surveyId);

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
});

export const validateSurveyPinAction = actionClient
  .inputSchema(ZValidateSurveyPinAction)
  .action(async ({ parsedInput }) => {
    await applyIPRateLimit(rateLimitConfigs.actions.validateSurveyPin);

    // Get survey data which includes pin information
    const survey = await getSurveyWithMetadata(parsedInput.surveyId);
    if (!survey) {
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
    }

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
      organizationId: workspaceContext.organizationId,
      workspaceCustomCss: workspaceContext.customCss,
      surveyId: survey.id,
      surveyCustomCss: survey.customCss,
    });
    const publicSurvey = omitCustomCssSource(survey);

    if (!originalPin) return { survey: publicSurvey, customCss };
    return { survey: publicSurvey, customCss, pinAuthToken: createLinkSurveyPinToken(survey.id) };
  });
