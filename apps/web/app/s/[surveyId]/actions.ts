"use server";

interface LinkSurveyEmailData {
  surveyId: string;
  email: string;
  surveyData?: {
    name?: string;
    subheading?: string;
  } | null;
}

interface ISurveyPinValidationResponse {
  error?: TSurveyPinValidationResponseError;
  survey?: TSurvey;
}

import { TSurveyPinValidationResponseError } from "@/app/s/[surveyId]/types";
import { sendLinkSurveyToVerifiedEmail } from "@/app/lib/email";
import { verifyTokenForLinkSurvey } from "@formbricks/lib/jwt";
import { getSurvey } from "@formbricks/lib/survey/service";
import { TSurvey } from "@formbricks/types/v1/surveys";

export async function sendLinkSurveyEmailAction(data: LinkSurveyEmailData) {
  if (!data.surveyData) {
    throw new Error("No survey data provided");
  }
  return await sendLinkSurveyToVerifiedEmail(data);
}
export async function verifyTokenAction(token: string, surveyId: string): Promise<boolean> {
  return await verifyTokenForLinkSurvey(token, surveyId);
}

export async function validateSurveyPin(
  surveyId: string,
  pin: number
): Promise<ISurveyPinValidationResponse> {
  try {
    const survey = await getSurvey(surveyId);
    if (!survey) return { error: TSurveyPinValidationResponseError.NOT_FOUND };

    const originalPin = survey.pin;

    if (!originalPin) return { survey };

    if (originalPin !== pin) return { error: TSurveyPinValidationResponseError.INCORRECT_PIN };

    return { survey };
  } catch (error) {
    return { error: TSurveyPinValidationResponseError.INTERNAL_SERVER_ERROR };
  }
}
