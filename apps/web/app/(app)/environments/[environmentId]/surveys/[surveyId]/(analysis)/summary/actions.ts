"use server";

import { getEmailTemplateHtml } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/emailTemplate";
import { generateSurveySingleUseId } from "@/app/lib/singleUseSurveys";
import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { sendEmbedSurveyPreviewEmail } from "@formbricks/lib/emails/emails";
import {
  createResultShareUrl,
  deleteResultShareUrlBySurveyId,
  getResultShareUrlsBySurveyId,
} from "@formbricks/lib/resultShareUrl/service";
import { canUserAccessSurvey } from "@formbricks/lib/survey/auth";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";

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

export async function generateResultShareUrlAction(surveyId: string): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const hasUserSurveyAccess = await canUserAccessSurvey(session.user.id, surveyId);
  if (!hasUserSurveyAccess) throw new AuthorizationError("Not authorized");

  return createResultShareUrl(surveyId);
}

export async function getResultShareUrlAction(surveyId: string): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const hasUserSurveyAccess = await canUserAccessSurvey(session.user.id, surveyId);
  if (!hasUserSurveyAccess) throw new AuthorizationError("Not authorized");

  return getResultShareUrlsBySurveyId(surveyId);
}

export async function deleteResultShareUrlAction(surveyId: string): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const hasUserSurveyAccess = await canUserAccessSurvey(session.user.id, surveyId);
  if (!hasUserSurveyAccess) throw new AuthorizationError("Not authorized");

  return await deleteResultShareUrlBySurveyId(surveyId);
}

export const getEmailHtmlAction = async (surveyId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const hasUserSurveyAccess = await canUserAccessSurvey(session.user.id, surveyId);
  if (!hasUserSurveyAccess) throw new AuthorizationError("Not authorized");

  return await getEmailTemplateHtml(surveyId);
};
