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
import { createSurvey, getSurveys } from "@formbricks/lib/survey/service";
import { verifyUserRoleAccess } from "@formbricks/lib/team/auth";
import { updateUser } from "@formbricks/lib/user/service";
import { TEnvironment } from "@formbricks/types/environment";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TProductUpdateInput } from "@formbricks/types/product";
import {
  TSurveyCTAQuestion,
  TSurveyDisplayOption,
  TSurveyInput,
  TSurveyQuestionType,
  TSurveyStatus,
  TSurveyType,
} from "@formbricks/types/surveys";
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

export const createSurveyFromTemplate = async (
  template: TTemplate,
  environment: TEnvironment,
  pathway: "link" | "in-app"
) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const userHasAccess = await hasUserEnvironmentAccess(session.user.id, environment.id);
  if (!userHasAccess) throw new AuthorizationError("Not authorized");

  // Set common survey properties
  const userId = session.user.id;
  const surveyType = environment?.widgetSetupCompleted ? "web" : "link";
  const autoComplete = surveyType === "web" ? 50 : null;

  // Construct survey input based on the pathway
  const surveyInput = constructSurveyInput(pathway, template, surveyType, autoComplete, userId);

  // For in-app pathway, check existing surveys before creation
  if (pathway === "in-app") {
    const existingSurveys = await getSurveys(environment.id);
    if (existingSurveys.length > 0) {
      return existingSurveys[0];
    }
  }

  // Create and return the new survey
  return await createSurvey(environment.id, surveyInput);
};

function constructSurveyInput(
  pathway: "link" | "in-app",
  template: TTemplate,
  surveyType: TSurveyType,
  autoComplete: number | null,
  userId: string
) {
  if (pathway === "link") {
    return {
      ...template.preset,
      type: surveyType,
      autoComplete: autoComplete || undefined,
      createdBy: userId,
    };
  } else {
    // "in-app" pathway
    return {
      ...template.preset,
      questions: template.preset.questions.map(
        (question) =>
          ({
            ...question,
            type: TSurveyQuestionType.CTA,
            headline: "You did it 🎉",
            html: "You're all set up. Create your own survey to gather exactly the feedback you need :)",
            buttonLabel: "Create survey",
            buttonExternal: true,
            buttonUrl: "https://app.formbricks.com",
            imageUrl: "https://formbricks-cdn.s3.eu-central-1.amazonaws.com/meme.png",
          }) as TSurveyCTAQuestion
      ),
      name: "First survey",
      type: surveyType,
      autoComplete: autoComplete || undefined,
      createdBy: userId,
      triggers: ["New Session"],
      status: "inProgress" as TSurveyStatus,
      displayOption: "respondMultiple" as TSurveyDisplayOption,
    };
  }
}

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
