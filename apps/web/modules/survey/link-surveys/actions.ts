"use server";

import { actionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromSurveyId } from "@/lib/utils/helper";
import { getOrganizationLogoUrl } from "@/modules/ee/whitelabel/email-customization/lib/organization";
import { sendLinkSurveyToVerifiedEmail } from "@/modules/email";
import { getIfResponseWithSurveyIdAndEmailExist } from "@/modules/survey/link-surveys/lib/response";
import { getSurvey, getSurveyPin } from "@/modules/survey/link-surveys/lib/survey";
import { z } from "zod";
import { ZLinkSurveyEmailData } from "@formbricks/types/email";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";

export const sendLinkSurveyEmailAction = actionClient
  .schema(ZLinkSurveyEmailData)
  .action(async ({ parsedInput }) => {
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
    const surveyPin = await getSurveyPin(parsedInput.surveyId);
    if (!surveyPin) {
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
    }

    const originalPin = surveyPin.toString();

    const survey = await getSurvey(parsedInput.surveyId);

    if (!originalPin) return { survey };
    if (originalPin !== parsedInput.pin) {
      throw new InvalidInputError("INVALID_PIN");
    }

    return { survey };
  });

const ZGetIfResponseWithSurveyIdAndEmailExistAction = z.object({
  surveyId: z.string().cuid2(),
  email: z.string().email(),
});

export const getIfResponseWithSurveyIdAndEmailExistAction = actionClient
  .schema(ZGetIfResponseWithSurveyIdAndEmailExistAction)
  .action(async ({ parsedInput }) => {
    return await getIfResponseWithSurveyIdAndEmailExist(parsedInput.surveyId, parsedInput.email);
  });
