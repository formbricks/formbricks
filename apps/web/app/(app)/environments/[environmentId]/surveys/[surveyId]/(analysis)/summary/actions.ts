"use server";

import { getEmailTemplateHtml } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/emailTemplate";
import { generateSurveySingleUseId } from "@/app/lib/singleUseSurveys";
import { authOptions } from "@formbricks/lib/authOptions";
import { sendEmbedSurveyPreviewEmail } from "@formbricks/lib/emails/emails";
import { canUserAccessSurvey } from "@formbricks/lib/survey/auth";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";
import { getServerSession } from "next-auth";
import {
  createResponseSharingkey,
  getResponseKeyBySurveyId,
  deleteResponseSharingKeyBySurveyId,
} from "@formbricks/lib/responseSharing/service";

type TSendEmailActionArgs = {
  to: string;
  subject: string;
  html: string;
};

export async function generateSingleUseIdAction(surveyId: string, isEncrypted: boolean): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const hasUserSurveyAccess = await canUserAccessSurvey(session.user.id, surveyId);

  if (!hasUserSurveyAccess) throw new AuthorizationError("Not authorized");

  return generateSurveySingleUseId(isEncrypted);
}

export const sendEmailAction = async ({ html, subject, to }: TSendEmailActionArgs) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }
  return await sendEmbedSurveyPreviewEmail(to, subject, html);
};


export async function generateResponseSharingKeyAction(surveyId: string): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");
  
  const hasUserSurveyAccess = await canUserAccessSurvey(session.user.id, surveyId);
  if (!hasUserSurveyAccess) throw new AuthorizationError("Not authorized");

  return createResponseSharingkey(surveyId);
}

export async function getResponseSharingKeyAction(surveyId: string): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const hasUserSurveyAccess = await canUserAccessSurvey(session.user.id, surveyId);
  if (!hasUserSurveyAccess) throw new AuthorizationError("Not authorized");

  return getResponseKeyBySurveyId(surveyId);
}

export async function deleteResponseSharingKeyAction(surveyId: string): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const hasUserSurveyAccess = await canUserAccessSurvey(session.user.id, surveyId);
  if (!hasUserSurveyAccess) throw new AuthorizationError("Not authorized");

  return await deleteResponseSharingKeyBySurveyId(surveyId);
}

export const getEmailHtmlAction = async (surveyId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const hasUserSurveyAccess = await canUserAccessSurvey(session.user.id, surveyId);
  if (!hasUserSurveyAccess) throw new AuthorizationError("Not authorized");

  return await getEmailTemplateHtml(surveyId);
};
