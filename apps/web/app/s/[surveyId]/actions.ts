"use server";

import { TSurveyPinValidationResponseError } from "@/app/s/[surveyId]/types";
import { z } from "zod";
import { sendLinkSurveyToVerifiedEmail } from "@formbricks/email";
import { actionClient } from "@formbricks/lib/actionClient";
import { getSurvey } from "@formbricks/lib/survey/service";
import { ZLinkSurveyEmailData } from "@formbricks/types/email";

export const sendLinkSurveyEmailAction = actionClient
  .schema(ZLinkSurveyEmailData)
  .action(async ({ parsedInput }) => {
    if (!parsedInput.surveyData) {
      throw new Error("No survey data provided");
    }
    return await sendLinkSurveyToVerifiedEmail(parsedInput);
  });

const ZValidateSurveyPinAction = z.object({
  surveyId: z.string(),
  pin: z.string(),
});

export const validateSurveyPinAction = actionClient
  .schema(ZValidateSurveyPinAction)
  .action(async ({ parsedInput }) => {
    const survey = await getSurvey(parsedInput.surveyId);
    if (!survey) return { error: TSurveyPinValidationResponseError.NOT_FOUND };

    const originalPin = survey.pin?.toString();

    if (!originalPin) return { survey };
    if (originalPin !== parsedInput.pin) return { error: TSurveyPinValidationResponseError.INCORRECT_PIN };

    return { survey };
  });
