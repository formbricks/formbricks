"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProducts } from "@formbricks/lib/product/service";
import { canUserAccessSurvey, verifyUserRoleAccess } from "@formbricks/lib/survey/auth";
import {
  copySurveyToOtherEnvironment,
  deleteSurvey,
  getSurvey,
  getSurveys,
} from "@formbricks/lib/survey/service";
import { generateSurveySingleUseId } from "@formbricks/lib/utils/singleUseSurveys";
import { AuthorizationError } from "@formbricks/types/errors";
import { TSurveyFilterCriteria } from "@formbricks/types/surveys/types";

export const getSurveyAction = async (surveyId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await getSurvey(surveyId);
};

export const copySurveyToOtherEnvironmentAction = async (
  environmentId: string,
  surveyId: string,
  targetEnvironmentId: string,
  targetProductId: string
) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isSameEnvironment = environmentId === targetEnvironmentId;

  // Optimize authorization checks
  if (isSameEnvironment) {
    const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
    if (!isAuthorized) throw new AuthorizationError("Not authorized");
  } else {
    const [sourceAccess, targetAccess] = await Promise.all([
      hasUserEnvironmentAccess(session.user.id, environmentId),
      hasUserEnvironmentAccess(session.user.id, targetEnvironmentId),
    ]);
    if (!sourceAccess || !targetAccess) throw new AuthorizationError("Not authorized");
  }

  const isAuthorizedForSurvey = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorizedForSurvey) throw new AuthorizationError("Not authorized");

  return await copySurveyToOtherEnvironment(
    environmentId,
    surveyId,
    targetEnvironmentId,
    targetProductId,
    session.user.id
  );
};

export const getProductsByEnvironmentIdAction = async (environmentId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const organization = await getOrganizationByEnvironmentId(environmentId);

  if (!organization) {
    throw new Error("No organization found");
  }

  const products = await getProducts(organization.id);
  return products;
};

export const deleteSurveyAction = async (surveyId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const survey = await getSurvey(surveyId);

  const { hasDeleteAccess } = await verifyUserRoleAccess(survey!.environmentId, session.user.id);
  if (!hasDeleteAccess) throw new AuthorizationError("Not authorized");

  await deleteSurvey(surveyId);
};

export const generateSingleUseIdAction = async (surveyId: string, isEncrypted: boolean): Promise<string> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const hasUserSurveyAccess = await canUserAccessSurvey(session.user.id, surveyId);

  if (!hasUserSurveyAccess) throw new AuthorizationError("Not authorized");

  return generateSurveySingleUseId(isEncrypted);
};

export const getSurveysAction = async (
  environmentId: string,
  limit?: number,
  offset?: number,
  filterCriteria?: TSurveyFilterCriteria
) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await getSurveys(environmentId, limit, offset, filterCriteria);
};
