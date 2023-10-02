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
} from "@formbricks/lib/services/actions";
import { getSurveysByActionClassId } from "@formbricks/lib/services/survey";
import { AuthorizationError } from "@formbricks/types/v1/errors";

export async function deleteActionAction(environmentId, actionClassId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessActionClass(session.user.id, actionClassId);

  if (isAuthorized) {
    // the environmentId is only needed for logging hence we can just pass whatever the client sends even if they want to tamper it
    await deleteActionClass(environmentId, actionClassId);
  } else {
    throw new AuthorizationError("Not authorized");
  }
}

export async function updateActionAction(
  environmentId: string,
  actionClassId: string,
  updatedAction: Partial<TActionClassInput>
) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessActionClass(session.user.id, actionClassId);

  if (isAuthorized) {
    // the environmentId is only needed for logging hence we can just pass whatever the client sends even if they want to tamper it
    return await updateActionClass(environmentId, actionClassId, updatedAction);
  } else {
    throw new AuthorizationError("Not authorized");
  }
}

export async function createActionAction(action: TActionClassInput) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, action.environmentId);

  if (isAuthorized) {
    return await createActionClass(action.environmentId, action);
  } else {
    throw new AuthorizationError("Not authorized");
  }
}

export const getActionCountInLastHourAction = async (actionClassId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessActionClass(session.user.id, actionClassId);
  if (isAuthorized) {
    return await getActionCountInLastHour(actionClassId);
  } else {
    throw new AuthorizationError("Not authorized");
  }
};

export const getActionCountInLast24HoursAction = async (actionClassId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessActionClass(session.user.id, actionClassId);
  if (isAuthorized) {
    return await getActionCountInLast24Hours(actionClassId);
  } else {
    throw new AuthorizationError("Not authorized");
  }
};

export const getActionCountInLast7DaysAction = async (actionClassId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessActionClass(session.user.id, actionClassId);
  if (isAuthorized) {
    return await getActionCountInLast7Days(actionClassId);
  } else {
    throw new AuthorizationError("Not authorized");
  }
};

export const GetActiveInactiveSurveysAction = async (
  actionClassId: string
): Promise<{ activeSurveys: string[]; inactiveSurveys: string[] }> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessActionClass(session.user.id, actionClassId);
  if (isAuthorized) {
    const surveys = await getSurveysByActionClassId(actionClassId);
    const response = {
      activeSurveys: surveys.filter((s) => s.status === "inProgress").map((survey) => survey.name),
      inactiveSurveys: surveys.filter((s) => s.status !== "inProgress").map((survey) => survey.name),
    };
    return response;
  } else {
    throw new AuthorizationError("Not authorized");
  }
};
