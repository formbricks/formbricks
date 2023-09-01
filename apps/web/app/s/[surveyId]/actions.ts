"use server";

interface LinkSurveyEmailData {
  surveyId: string;
  email: string;
  surveyData: {
    name?: string;
    subheading?: string;
  };
}

import { sendLinkSurveyToVerifiedEmail } from "@/lib/email";
import { verifyTokenForLinkSurvey } from "@/lib/jwt";

export async function sendLinkSurveyEmailAction(data: LinkSurveyEmailData) {
  return await sendLinkSurveyToVerifiedEmail(data);
}
export async function verifyTokenAction(token: string, surveyId: string): Promise<boolean> {
  return await verifyTokenForLinkSurvey(token, surveyId);
}
