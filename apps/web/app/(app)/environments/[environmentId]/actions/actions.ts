"use server";

import { getServerSession } from "next-auth";
import { canUserUpdateActionClass, verifyUserRoleAccess } from "@formbricks/lib/actionClass/auth";
import { deleteActionClass, updateActionClass } from "@formbricks/lib/actionClass/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getSurveysByActionClassId } from "@formbricks/lib/survey/service";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { AuthorizationError } from "@formbricks/types/errors";

export const deleteActionClassAction = async (environmentId, actionClassId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const organization = await getOrganizationByEnvironmentId(environmentId);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const isAuthorized = await canUserUpdateActionClass(session.user.id, actionClassId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const { hasDeleteAccess } = await verifyUserRoleAccess(environmentId, session.user.id);
  if (!hasDeleteAccess) throw new AuthorizationError("Not authorized");

  await deleteActionClass(environmentId, actionClassId);
};

export const updateActionClassAction = async (
  environmentId: string,
  actionClassId: string,
  updatedAction: Partial<TActionClassInput>
) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const organization = await getOrganizationByEnvironmentId(environmentId);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const isAuthorized = await canUserUpdateActionClass(session.user.id, actionClassId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const { hasCreateOrUpdateAccess } = await verifyUserRoleAccess(environmentId, session.user.id);
  if (!hasCreateOrUpdateAccess) throw new AuthorizationError("Not authorized");

  return await updateActionClass(environmentId, actionClassId, updatedAction);
};

export const getActiveInactiveSurveysAction = async (
  actionClassId: string,
  environmentId: string
): Promise<{ activeSurveys: string[]; inactiveSurveys: string[] }> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const organization = await getOrganizationByEnvironmentId(environmentId);

  if (!organization) {
    throw new Error("Organization not found");
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
