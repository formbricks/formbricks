"use server";

import { prisma } from "@formbricks/database";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { deleteSurvey, getSurvey } from "@formbricks/lib/survey/service";
import { Team } from "@prisma/client";
import { Prisma as prismaClient } from "@prisma/client/";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import { canUserAccessSurvey } from "@formbricks/lib/survey/auth";
import { createProduct, updateProduct } from "@formbricks/lib/services/product";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { createTeam, getTeamByEnvironmentId } from "@formbricks/lib/services/team";
import { createMembership } from "@formbricks/lib/services/membership";
import { createEnvironment } from "@formbricks/lib/services/environment";
import { populateEnvironment } from "@formbricks/lib/utils/createDemoProductHelpers";

export async function createTeamAction(teamName: string): Promise<Team> {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const newTeam = await createTeam({
    name: teamName,
  });

  await createMembership(newTeam.id, session.user.id, {
    role: "owner",
    accepted: true,
  });

  const product = await createProduct(newTeam.id, {
    name: "My Product",
  });

  const devEnvironment = await createEnvironment({
    type: "development",
    productId: product.id,
    eventClasses: populateEnvironment.eventClasses.create,
    attributeClasses: populateEnvironment.attributeClasses.create,
  });

  const prodEnvironment = await createEnvironment({
    type: "production",
    productId: product.id,
    eventClasses: populateEnvironment.eventClasses.create,
    attributeClasses: populateEnvironment.attributeClasses.create,
  });

  await updateProduct(product.id, {
    environments: [devEnvironment, prodEnvironment],
  });

  return newTeam;
}

export async function duplicateSurveyAction(environmentId: string, surveyId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const existingSurvey = await getSurvey(surveyId);

  if (!existingSurvey) {
    throw new ResourceNotFoundError("Survey", surveyId);
  }

  // create new survey with the data of the existing survey
  const newSurvey = await prisma.survey.create({
    data: {
      ...existingSurvey,
      id: undefined, // id is auto-generated
      environmentId: undefined, // environmentId is set below
      name: `${existingSurvey.name} (copy)`,
      status: "draft",
      questions: JSON.parse(JSON.stringify(existingSurvey.questions)),
      thankYouCard: JSON.parse(JSON.stringify(existingSurvey.thankYouCard)),
      triggers: {
        create: existingSurvey.triggers.map((trigger) => ({
          eventClassId: trigger.id,
        })),
      },
      attributeFilters: {
        create: existingSurvey.attributeFilters.map((attributeFilter) => ({
          attributeClassId: attributeFilter.attributeClassId,
          condition: attributeFilter.condition,
          value: attributeFilter.value,
        })),
      },
      environment: {
        connect: {
          id: environmentId,
        },
      },
      surveyClosedMessage: existingSurvey.surveyClosedMessage
        ? JSON.parse(JSON.stringify(existingSurvey.surveyClosedMessage))
        : prismaClient.JsonNull,

      verifyEmail: existingSurvey.verifyEmail
        ? JSON.parse(JSON.stringify(existingSurvey.verifyEmail))
        : prismaClient.JsonNull,
    },
  });
  return newSurvey;
}

export async function copyToOtherEnvironmentAction(
  environmentId: string,
  surveyId: string,
  targetEnvironmentId: string
) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorizedToAccessSourceEnvironment = await hasUserEnvironmentAccess(
    session.user.id,
    environmentId
  );
  if (!isAuthorizedToAccessSourceEnvironment) throw new AuthorizationError("Not authorized");

  const isAuthorizedToAccessTargetEnvironment = await hasUserEnvironmentAccess(
    session.user.id,
    targetEnvironmentId
  );
  if (!isAuthorizedToAccessTargetEnvironment) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const existingSurvey = await prisma.survey.findFirst({
    where: {
      id: surveyId,
      environmentId,
    },
    include: {
      triggers: {
        include: {
          eventClass: true,
        },
      },
      attributeFilters: {
        include: {
          attributeClass: true,
        },
      },
    },
  });

  if (!existingSurvey) {
    throw new ResourceNotFoundError("Survey", surveyId);
  }

  let targetEnvironmentTriggers: string[] = [];
  // map the local triggers to the target environment
  for (const trigger of existingSurvey.triggers) {
    const targetEnvironmentTrigger = await prisma.eventClass.findFirst({
      where: {
        name: trigger.eventClass.name,
        environment: {
          id: targetEnvironmentId,
        },
      },
    });
    if (!targetEnvironmentTrigger) {
      // if the trigger does not exist in the target environment, create it
      const newTrigger = await prisma.eventClass.create({
        data: {
          name: trigger.eventClass.name,
          environment: {
            connect: {
              id: targetEnvironmentId,
            },
          },
          description: trigger.eventClass.description,
          type: trigger.eventClass.type,
          noCodeConfig: trigger.eventClass.noCodeConfig
            ? JSON.parse(JSON.stringify(trigger.eventClass.noCodeConfig))
            : undefined,
        },
      });
      targetEnvironmentTriggers.push(newTrigger.id);
    } else {
      targetEnvironmentTriggers.push(targetEnvironmentTrigger.id);
    }
  }

  let targetEnvironmentAttributeFilters: string[] = [];
  // map the local attributeFilters to the target env
  for (const attributeFilter of existingSurvey.attributeFilters) {
    // check if attributeClass exists in target env.
    // if not, create it
    const targetEnvironmentAttributeClass = await prisma.attributeClass.findFirst({
      where: {
        name: attributeFilter.attributeClass.name,
        environment: {
          id: targetEnvironmentId,
        },
      },
    });
    if (!targetEnvironmentAttributeClass) {
      const newAttributeClass = await prisma.attributeClass.create({
        data: {
          name: attributeFilter.attributeClass.name,
          description: attributeFilter.attributeClass.description,
          type: attributeFilter.attributeClass.type,
          environment: {
            connect: {
              id: targetEnvironmentId,
            },
          },
        },
      });
      targetEnvironmentAttributeFilters.push(newAttributeClass.id);
    } else {
      targetEnvironmentAttributeFilters.push(targetEnvironmentAttributeClass.id);
    }
  }

  // create new survey with the data of the existing survey
  const newSurvey = await prisma.survey.create({
    data: {
      ...existingSurvey,
      id: undefined, // id is auto-generated
      environmentId: undefined, // environmentId is set below
      name: `${existingSurvey.name} (copy)`,
      status: "draft",
      questions: JSON.parse(JSON.stringify(existingSurvey.questions)),
      thankYouCard: JSON.parse(JSON.stringify(existingSurvey.thankYouCard)),
      triggers: {
        create: targetEnvironmentTriggers.map((eventClassId) => ({
          eventClassId: eventClassId,
        })),
      },
      attributeFilters: {
        create: existingSurvey.attributeFilters.map((attributeFilter, idx) => ({
          attributeClassId: targetEnvironmentAttributeFilters[idx],
          condition: attributeFilter.condition,
          value: attributeFilter.value,
        })),
      },
      environment: {
        connect: {
          id: targetEnvironmentId,
        },
      },
      surveyClosedMessage: existingSurvey.surveyClosedMessage ?? prismaClient.JsonNull,
      verifyEmail: existingSurvey.verifyEmail ?? prismaClient.JsonNull,
    },
  });
  return newSurvey;
}

export const deleteSurveyAction = async (surveyId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  await deleteSurvey(surveyId);
};

export const createProductAction = async (environmentId: string, productName: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const team = await getTeamByEnvironmentId(environmentId);
  if (!team) throw new ResourceNotFoundError("Team from environment", environmentId);

  const product = await createProduct(team.id, {
    name: productName,
  });

  const devEnvironment = await createEnvironment({
    type: "development",
    productId: product.id,
    eventClasses: populateEnvironment.eventClasses.create,
    attributeClasses: populateEnvironment.attributeClasses.create,
  });

  const prodEnvironment = await createEnvironment({
    type: "production",
    productId: product.id,
    eventClasses: populateEnvironment.eventClasses.create,
    attributeClasses: populateEnvironment.attributeClasses.create,
  });

  const updatedProduct = await updateProduct(product.id, {
    environments: [devEnvironment, prodEnvironment],
  });

  const newEnvironment = updatedProduct.environments[0];
  return newEnvironment;
};
