"use server";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { createActionClass, deleteActionClass, updateActionClass } from "@formbricks/lib/actionClass/service";
import { canUserAccessActionClass } from "@formbricks/lib/actionClass/auth";
import { getServerSession } from "next-auth";
import { TActionClassInput } from "@formbricks/types/v1/actionClasses";

import {
  getActionCountInLast24Hours,
  getActionCountInLast7Days,
  getActionCountInLastHour,
} from "@formbricks/lib/action/service";
import { getSurveysByActionClassId } from "@formbricks/lib/survey/service";
import { AuthorizationError } from "@formbricks/types/v1/errors";

export async function deleteActionClassAction(environmentId, actionClassId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessActionClass(session.user.id, actionClassId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  await deleteActionClass(environmentId, actionClassId);
}

export async function updateActionClassAction(
  environmentId: string,
  actionClassId: string,
  updatedAction: Partial<TActionClassInput>
) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessActionClass(session.user.id, actionClassId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await updateActionClass(environmentId, actionClassId, updatedAction);
}

export async function createActionClassAction(action: TActionClassInput) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, action.environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await createActionClass(action.environmentId, action);
}

export const getActionCountInLastHourAction = async (actionClassId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessActionClass(session.user.id, actionClassId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await getActionCountInLastHour(actionClassId);
};

export const getActionCountInLast24HoursAction = async (actionClassId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessActionClass(session.user.id, actionClassId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await getActionCountInLast24Hours(actionClassId);
};

export const getActionCountInLast7DaysAction = async (actionClassId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessActionClass(session.user.id, actionClassId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await getActionCountInLast7Days(actionClassId);
};

export const GetActiveInactiveSurveysAction = async (
  actionClassId: string
): Promise<{ activeSurveys: string[]; inactiveSurveys: string[] }> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessActionClass(session.user.id, actionClassId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const surveys = await getSurveysByActionClassId(actionClassId);
  const response = {
    activeSurveys: surveys.filter((s) => s.status === "inProgress").map((survey) => survey.name),
    inactiveSurveys: surveys.filter((s) => s.status !== "inProgress").map((survey) => survey.name),
  };
  return response;
};
