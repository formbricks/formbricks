"use server";

import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { INTERNAL_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { deleteSurvey, getSurvey } from "@formbricks/lib/survey/service";
import { Team } from "@prisma/client";
import { Prisma as prismaClient } from "@prisma/client/";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import { canUserAccessSurveyCached } from "@formbricks/lib/survey/auth";
import { createProduct } from "@formbricks/lib/services/product";
import { hasUserEnvironmentAccessCached } from "@formbricks/lib/environment/auth";

export async function createTeam(teamName: string): Promise<Team> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("You are not authorized to perform this action.");

  const newTeam = await prisma.team.create({
    data: {
      name: teamName,
      memberships: {
        create: {
          user: { connect: { id: session.user.id } },
          role: "owner",
          accepted: true,
        },
      },
      products: {
        create: [
          {
            name: "My Product",
            environments: {
              create: [
                {
                  type: "production",
                  eventClasses: {
                    create: [
                      {
                        name: "New Session",
                        description: "Gets fired when a new session is created",
                        type: "automatic",
                      },
                      {
                        name: "Exit Intent (Desktop)",
                        description: "A user on Desktop leaves the website with the cursor.",
                        type: "automatic",
                      },
                      {
                        name: "50% Scroll",
                        description: "A user scrolled 50% of the current page",
                        type: "automatic",
                      },
                    ],
                  },
                  attributeClasses: {
                    create: [
                      {
                        name: "userId",
                        description: "The internal ID of the person",
                        type: "automatic",
                      },
                      {
                        name: "email",
                        description: "The email of the person",
                        type: "automatic",
                      },
                    ],
                  },
                },
                {
                  type: "development",
                  eventClasses: {
                    create: [
                      {
                        name: "New Session",
                        description: "Gets fired when a new session is created",
                        type: "automatic",
                      },
                      {
                        name: "Exit Intent (Desktop)",
                        description: "A user on Desktop leaves the website with the cursor.",
                        type: "automatic",
                      },
                      {
                        name: "50% Scroll",
                        description: "A user scrolled 50% of the current page",
                        type: "automatic",
                      },
                    ],
                  },
                  attributeClasses: {
                    create: [
                      {
                        name: "userId",
                        description: "The internal ID of the person",
                        type: "automatic",
                      },
                      {
                        name: "email",
                        description: "The email of the person",
                        type: "automatic",
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      memberships: true,
      products: {
        include: {
          environments: true,
        },
      },
    },
  });

  const teamId = newTeam?.id;

  if (teamId) {
    fetch(`${WEBAPP_URL}/api/v1/teams/${teamId}/add_demo_product`, {
      method: "POST",
      headers: {
        "x-api-key": INTERNAL_SECRET,
      },
    });
  }

  return newTeam;
}

export async function duplicateSurveyAction(environmentId: string, surveyId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("You are not authorized to perform this action.");

  const isAuthorized = await canUserAccessSurveyCached(session.user.id, surveyId);
  if (!isAuthorized) throw new Error("You are not authorized to perform this action.");

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
  if (!session) throw new Error("You are not authorized to perform this action.");

  const isAuthorizedToAccessSourceEnvironment = await hasUserEnvironmentAccessCached(
    session.user.id,
    environmentId
  );
  if (!isAuthorizedToAccessSourceEnvironment)
    throw new Error("You are not authorized to perform this action.");

  const isAuthorizedToAccessTargetEnvironment = await hasUserEnvironmentAccessCached(
    session.user.id,
    targetEnvironmentId
  );
  if (!isAuthorizedToAccessTargetEnvironment)
    throw new Error("You are not authorized to perform this action.");

  const isAuthorized = await canUserAccessSurveyCached(session.user.id, surveyId);
  if (!isAuthorized) throw new Error("You are not authorized to perform this action.");

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
  if (!session) throw new Error("You are not authorized to perform this action.");

  const isAuthorized = await canUserAccessSurveyCached(session.user.id, surveyId);
  if (isAuthorized) {
    await deleteSurvey(surveyId);
  } else {
    throw new Error("You are not authorized to perform this action.");
  }
};

export const createProductAction = async (environmentId: string, productName: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("You are not authorized to perform this action.");

  const isAuthorized = await hasUserEnvironmentAccessCached(session.user.id, environmentId);
  if (isAuthorized) {
    const productCreated = await createProduct(environmentId, productName);

    const newEnvironment = productCreated.environments[0];
    return newEnvironment;
  } else {
    throw new Error("You are not authorized to perform this action.");
  }
};
