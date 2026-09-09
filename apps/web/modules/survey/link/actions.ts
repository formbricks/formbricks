"use server";

import { z } from "zod";
import { ZLinkSurveyEmailData } from "@formbricks/types/email";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { actionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromSurveyId } from "@/lib/utils/helper";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getOrganizationLogoUrl } from "@/modules/ee/whitelabel/email-customization/lib/organization";
import { sendLinkSurveyToVerifiedEmail } from "@/modules/email";
import { getSurveyWithMetadata } from "@/modules/survey/link/lib/data";
import { resolveSurveyLanguageCode } from "@/modules/survey/link/lib/language";
import { createLinkSurveyPinToken } from "@/modules/survey/link/lib/pin-token";

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
    const surveyLanguageCode = resolveSurveyLanguageCode(parsedInput.surveyLanguageCode, survey);

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

    if (!originalPin) return { survey };
    if (originalPin !== parsedInput.pin) {
      throw new InvalidInputError("INVALID_PIN");
    }

    return { survey, pinAuthToken: createLinkSurveyPinToken(survey.id) };
  });
