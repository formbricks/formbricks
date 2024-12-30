"use server";

import { actionClient } from "@/lib/utils/action-client";
import { sendLinkSurveyToVerifiedEmail } from "@/modules/email";
import { z } from "zod";
import { verifyTokenForLinkSurvey } from "@formbricks/lib/jwt";
import { getIfResponseWithSurveyIdAndEmailExist } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { ZId } from "@formbricks/types/common";
import { ZLinkSurveyEmailData } from "@formbricks/types/email";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";

export const sendLinkSurveyEmailAction = actionClient
  .schema(ZLinkSurveyEmailData)
  .action(async ({ parsedInput }) => {
    await sendLinkSurveyToVerifiedEmail(parsedInput);
    return { success: true };
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
    if (!survey) throw new ResourceNotFoundError("Survey", parsedInput.surveyId);

    const originalPin = survey.pin?.toString();

    if (!originalPin) return { survey };
    if (originalPin !== parsedInput.pin) throw new InvalidInputError("Invalid pin");

    return { survey };
  });

const ZGetIfResponseWithSurveyIdAndEmailExistAction = z.object({
  surveyId: ZId,
  email: z.string(),
});

export const getIfResponseWithSurveyIdAndEmailExistAction = actionClient
  .schema(ZGetIfResponseWithSurveyIdAndEmailExistAction)
  .action(async ({ parsedInput }) => {
    return await getIfResponseWithSurveyIdAndEmailExist(parsedInput.surveyId, parsedInput.email);
  });
