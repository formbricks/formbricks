"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { createSurvey } from "@formbricks/lib/survey/service";
import { AuthorizationError, OperationNotAllowedError } from "@formbricks/types/errors";
import { TSurveyInput } from "@formbricks/types/surveys/types";

export const createSurveyAction = async (environmentId: string, surveyBody: TSurveyInput) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authenticated");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const organization = await getOrganizationByEnvironmentId(environmentId);
  if (!organization) throw new Error("Organization not found");

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, organization.id);
  if (!membership || membership.role === "viewer") {
    throw OperationNotAllowedError;
  }

  return await createSurvey(environmentId, surveyBody);
};
