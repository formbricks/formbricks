"use server";

import { actionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromSurveyId } from "@/lib/utils/helper";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getOrganizationLogoUrl } from "@/modules/ee/whitelabel/email-customization/lib/organization";
import { sendLinkSurveyToVerifiedEmail } from "@/modules/email";
import { getSurveyWithMetadata, isSurveyResponsePresent } from "@/modules/survey/link/lib/data";
import { z } from "zod";
import { ZLinkSurveyEmailData } from "@formbricks/types/email";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";

export const sendLinkSurveyEmailAction = actionClient
  .schema(ZLinkSurveyEmailData)
  .action(async ({ parsedInput }) => {
    await applyIPRateLimit(rateLimitConfigs.actions.sendLinkSurveyEmail);

    const survey = await getSurveyWithMetadata(parsedInput.surveyId);

    if (!survey.isVerifyEmailEnabled) {
      throw new InvalidInputError("EMAIL_VERIFICATION_NOT_ENABLED");
    }

    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    const organizationLogoUrl = await getOrganizationLogoUrl(organizationId);

    await sendLinkSurveyToVerifiedEmail({ ...parsedInput, logoUrl: organizationLogoUrl || "" });
    return { success: true };
  });

const ZValidateSurveyPinAction = z.object({
  surveyId: z.string().cuid2(),
  pin: z.string(),
});

export const validateSurveyPinAction = actionClient
  .schema(ZValidateSurveyPinAction)
  .action(async ({ parsedInput }) => {
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

    return { survey };
  });

const ZIsSurveyResponsePresentAction = z.object({
  surveyId: z.string().cuid2(),
  email: z.string().email(),
});

export const isSurveyResponsePresentAction = actionClient
  .schema(ZIsSurveyResponsePresentAction)
  .action(async ({ parsedInput }) => {
    return await isSurveyResponsePresent(parsedInput.surveyId, parsedInput.email)();
  });
