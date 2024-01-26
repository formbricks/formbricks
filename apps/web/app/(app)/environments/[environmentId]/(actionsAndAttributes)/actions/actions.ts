"use server";

import { getServerSession } from "next-auth";

import {
  getActionCountInLast7Days,
  getActionCountInLast24Hours,
  getActionCountInLastHour,
} from "@formbricks/lib/action/service";
import { canUserUpdateActionClass, verifyUserRoleAccess } from "@formbricks/lib/actionClass/auth";
import { createActionClass, deleteActionClass, updateActionClass } from "@formbricks/lib/actionClass/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getSurveysByActionClassId } from "@formbricks/lib/survey/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { TActionClassInput } from "@formbricks/types/actionClasses";
import { AuthorizationError } from "@formbricks/types/errors";

export async function deleteActionClassAction(environmentId, actionClassId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const team = await getTeamByEnvironmentId(environmentId);

  if (!team) {
    throw new Error("Team not found");
  }

  const isAuthorized = await canUserUpdateActionClass(session.user.id, actionClassId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const { hasDeleteAccess } = await verifyUserRoleAccess(environmentId, session.user.id);
  if (!hasDeleteAccess) throw new AuthorizationError("Not authorized");

  await deleteActionClass(environmentId, actionClassId);
}

export async function updateActionClassAction(
  environmentId: string,
  actionClassId: string,
  updatedAction: Partial<TActionClassInput>
) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const team = await getTeamByEnvironmentId(environmentId);

  if (!team) {
    throw new Error("Team not found");
  }

  const isAuthorized = await canUserUpdateActionClass(session.user.id, actionClassId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const { hasCreateOrUpdateAccess } = await verifyUserRoleAccess(environmentId, session.user.id);
  if (!hasCreateOrUpdateAccess) throw new AuthorizationError("Not authorized");

  return await updateActionClass(environmentId, actionClassId, updatedAction);
}

export async function createActionClassAction(action: TActionClassInput) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, action.environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await createActionClass(action.environmentId, action);
}

export const getActionCountInLastHourAction = async (actionClassId: string, environmentId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const team = await getTeamByEnvironmentId(environmentId);

  if (!team) {
    throw new Error("Team not found");
  }

  const isAuthorized = await canUserUpdateActionClass(session.user.id, actionClassId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await getActionCountInLastHour(actionClassId);
};

export const getActionCountInLast24HoursAction = async (actionClassId: string, environmentId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const team = await getTeamByEnvironmentId(environmentId);

  if (!team) {
    throw new Error("Team not found");
  }

  const isAuthorized = await canUserUpdateActionClass(session.user.id, actionClassId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await getActionCountInLast24Hours(actionClassId);
};

export const getActionCountInLast7DaysAction = async (actionClassId: string, environmentId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const team = await getTeamByEnvironmentId(environmentId);

  if (!team) {
    throw new Error("Team not found");
  }

  const isAuthorized = await canUserUpdateActionClass(session.user.id, actionClassId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await getActionCountInLast7Days(actionClassId);
};

export const GetActiveInactiveSurveysAction = async (
  actionClassId: string,
  environmentId: string
): Promise<{ activeSurveys: string[]; inactiveSurveys: string[] }> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const team = await getTeamByEnvironmentId(environmentId);

  if (!team) {
    throw new Error("Team not found");
  }

  const isAuthorized = await canUserUpdateActionClass(session.user.id, actionClassId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const surveys = await getSurveysByActionClassId(actionClassId);
  const response = {
    activeSurveys: surveys.filter((s) => s.status === "inProgress").map((survey) => survey.name),
    inactiveSurveys: surveys.filter((s) => s.status !== "inProgress").map((survey) => survey.name),
  };
  return response;
};
