"use server";

import { getServerSession } from "next-auth";

import { hasTeamAuthority } from "@formbricks/lib/auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { INVITE_DISABLED } from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { inviteUser } from "@formbricks/lib/invite/service";
import { canUserAccessProduct } from "@formbricks/lib/product/auth";
import { getProduct, updateProduct } from "@formbricks/lib/product/service";
import { createSurvey } from "@formbricks/lib/survey/service";
import { verifyUserRoleAccess } from "@formbricks/lib/team/auth";
import { updateUser } from "@formbricks/lib/user/service";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TProductUpdateInput } from "@formbricks/types/product";
import { TSurveyInput, TSurveyType } from "@formbricks/types/surveys";
import { TTemplate } from "@formbricks/types/templates";
import { TUserUpdateInput } from "@formbricks/types/user";

export const inviteTeamMateAction = async (
  teamId: string,
  email: string,
  role: TMembershipRole,
  inviteMessage: string
) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const isUserAuthorized = await hasTeamAuthority(session.user.id, teamId);

  if (INVITE_DISABLED) {
    throw new AuthenticationError("Invite disabled");
  }

  if (!isUserAuthorized) {
    throw new AuthenticationError("Not authorized");
  }

  const { hasCreateOrUpdateMembersAccess } = await verifyUserRoleAccess(teamId, session.user.id);
  if (!hasCreateOrUpdateMembersAccess) {
    throw new AuthenticationError("Not authorized");
  }

  const invite = await inviteUser({
    teamId,
    currentUser: { id: session.user.id, name: session.user.name },
    invitee: {
      email,
      name: "",
      role,
    },
    isOnboardingInvite: true,
    inviteMessage: inviteMessage,
  });

  return invite;
};

export const finishOnboardingAction = async () => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const updatedProfile = { onboardingCompleted: true };
  return await updateUser(session.user.id, updatedProfile);
};

export async function createSurveyAction(environmentId: string, surveyBody: TSurveyInput) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await createSurvey(environmentId, surveyBody);
}

export async function fetchEnvironment(id: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  return await getEnvironment(id);
}

export const createSurveyFromTemplate = async (template: TTemplate, environmentId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const userHasAccess = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!userHasAccess) throw new AuthorizationError("Not authorized");

  // Set common survey properties
  const userId = session.user.id;
  // Construct survey input based on the pathway
  const surveyInput = {
    ...template.preset,
    type: "link" as TSurveyType,
    autoComplete: undefined,
    createdBy: userId,
  };
  // Create and return the new survey
  return await createSurvey(environmentId, surveyInput);
};

export async function updateUserAction(updatedUser: TUserUpdateInput) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  return await updateUser(session.user.id, updatedUser);
}

export async function updateProductAction(productId: string, updatedProduct: Partial<TProductUpdateInput>) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessProduct(session.user.id, productId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const product = await getProduct(productId);

  const { hasCreateOrUpdateAccess } = await verifyUserRoleAccess(product!.teamId, session.user.id);
  if (!hasCreateOrUpdateAccess) throw new AuthorizationError("Not authorized");

  return await updateProduct(productId, updatedProduct);
}
