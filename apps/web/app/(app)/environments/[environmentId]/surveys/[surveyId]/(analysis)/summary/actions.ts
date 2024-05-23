"use server";

import { getEmailTemplateHtml } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/emailTemplate";
import { customAlphabet } from "nanoid";
import { getServerSession } from "next-auth";

import { sendEmbedSurveyPreviewEmail } from "@formbricks/email";
import { authOptions } from "@formbricks/lib/authOptions";
import { canUserAccessSurvey } from "@formbricks/lib/survey/auth";
import { getSurvey, updateSurvey } from "@formbricks/lib/survey/service";
import { AuthenticationError, AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";

export const sendEmbedSurveyPreviewEmailAction = async (surveyId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new ResourceNotFoundError("Survey", surveyId);
  }

  const isUserAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isUserAuthorized) {
    throw new AuthorizationError("Not authorized");
  }
  const rawEmailHtml = await getEmailTemplateHtml(surveyId);
  const emailHtml = rawEmailHtml
    .replaceAll("?preview=true&amp;", "?")
    .replaceAll("?preview=true&;", "?")
    .replaceAll("?preview=true", "");

  return await sendEmbedSurveyPreviewEmail(
    session.user.email,
    "Formbricks Email Survey Preview",
    emailHtml,
    survey.environmentId
  );
};

export const generateResultShareUrlAction = async (surveyId: string): Promise<string> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const hasUserSurveyAccess = await canUserAccessSurvey(session.user.id, surveyId);
  if (!hasUserSurveyAccess) throw new AuthorizationError("Not authorized");

  const survey = await getSurvey(surveyId);
  if (!survey?.id) {
    throw new ResourceNotFoundError("Survey", surveyId);
  }

  const resultShareKey = customAlphabet(
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    20
  )();

  await updateSurvey({ ...survey, resultShareKey });

  return resultShareKey;
};

export const getResultShareUrlAction = async (surveyId: string): Promise<string | null> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const hasUserSurveyAccess = await canUserAccessSurvey(session.user.id, surveyId);
  if (!hasUserSurveyAccess) throw new AuthorizationError("Not authorized");

  const survey = await getSurvey(surveyId);
  if (!survey?.id) {
    throw new ResourceNotFoundError("Survey", surveyId);
  }

  return survey.resultShareKey;
};

export const deleteResultShareUrlAction = async (surveyId: string): Promise<void> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const hasUserSurveyAccess = await canUserAccessSurvey(session.user.id, surveyId);
  if (!hasUserSurveyAccess) throw new AuthorizationError("Not authorized");

  const survey = await getSurvey(surveyId);
  if (!survey?.id) {
    throw new ResourceNotFoundError("Survey", surveyId);
  }

  await updateSurvey({ ...survey, resultShareKey: null });
};

export const getEmailHtmlAction = async (surveyId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const hasUserSurveyAccess = await canUserAccessSurvey(session.user.id, surveyId);
  if (!hasUserSurveyAccess) throw new AuthorizationError("Not authorized");

  return await getEmailTemplateHtml(surveyId);
};
