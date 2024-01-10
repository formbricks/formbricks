"use server";

import { TSurveyPinValidationResponseError } from "@/app/s/[surveyId]/types";

import { LinkSurveyEmailData, sendLinkSurveyToVerifiedEmail } from "@formbricks/lib/emails/emails";
import { verifyTokenForLinkSurvey } from "@formbricks/lib/jwt";
import { getSurvey } from "@formbricks/lib/survey/service";
import { TSurvey } from "@formbricks/types/surveys";

interface TSurveyPinValidationResponse {
  error?: TSurveyPinValidationResponseError;
  survey?: TSurvey;
}

export async function sendLinkSurveyEmailAction(data: LinkSurveyEmailData) {
  if (!data.surveyData) {
    throw new Error("No survey data provided");
  }
  return await sendLinkSurveyToVerifiedEmail(data);
}
export async function verifyTokenAction(token: string, surveyId: string): Promise<boolean> {
  return await verifyTokenForLinkSurvey(token, surveyId);
}

export async function validateSurveyPinAction(
  surveyId: string,
  pin: string
): Promise<TSurveyPinValidationResponse> {
  try {
    const survey = await getSurvey(surveyId);
    if (!survey) return { error: TSurveyPinValidationResponseError.NOT_FOUND };

    const originalPin = survey.pin?.toString();

    if (!originalPin) return { survey };

    if (originalPin !== pin) return { error: TSurveyPinValidationResponseError.INCORRECT_PIN };

    return { survey };
  } catch (error) {
    return { error: TSurveyPinValidationResponseError.INTERNAL_SERVER_ERROR };
  }
}
