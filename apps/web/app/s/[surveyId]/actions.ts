"use server";

import { TSurveyPinValidationResponseError } from "@/app/s/[surveyId]/types";
import { z } from "zod";
import { sendLinkSurveyToVerifiedEmail } from "@formbricks/email";
import { actionClient } from "@formbricks/lib/actionClient";
import { verifyTokenForLinkSurvey } from "@formbricks/lib/jwt";
import { getSurvey } from "@formbricks/lib/survey/service";
import { ZId } from "@formbricks/types/common";
import { ZLinkSurveyEmailData } from "@formbricks/types/email";

export const sendLinkSurveyEmailAction = actionClient
  .schema(ZLinkSurveyEmailData)
  .action(async ({ parsedInput }) => {
    return await sendLinkSurveyToVerifiedEmail(parsedInput);
  });

const ZVerifyTokenAction = z.object({
  surveyId: ZId,
  token: z.string(),
});

export const verifyTokenAction = actionClient.schema(ZVerifyTokenAction).action(async ({ parsedInput }) => {
  return await verifyTokenForLinkSurvey(parsedInput.token, parsedInput.surveyId);
});

const ZValidateSurveyPinAction = z.object({
  surveyId: ZId,
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
