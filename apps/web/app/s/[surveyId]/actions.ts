"use server";

interface LinkSurveyEmailData {
  surveyId: string;
  email: string;
  surveyData?: {
    name?: string;
    subheading?: string;
  } | null;
}

import { sendLinkSurveyToVerifiedEmail } from "@/lib/email";
import { verifyTokenForLinkSurvey } from "@formbricks/lib/jwt";

export async function sendLinkSurveyEmailAction(data: LinkSurveyEmailData) {
  if (!data.surveyData) {
    throw new Error("No survey data provided");
  }
  return await sendLinkSurveyToVerifiedEmail(data);
}
export async function verifyTokenAction(token: string, surveyId: string): Promise<boolean> {
  return await verifyTokenForLinkSurvey(token, surveyId);
}
