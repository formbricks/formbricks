"use server";

import { Team } from "@prisma/client";
import { Prisma as prismaClient } from "@prisma/client/";
import { getServerSession } from "next-auth";

import { prisma } from "@formbricks/database";
import { authOptions } from "@formbricks/lib/authOptions";
import { SHORT_URL_BASE, WEBAPP_URL } from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { createMembership } from "@formbricks/lib/membership/service";
import { createProduct } from "@formbricks/lib/product/service";
import { createShortUrl } from "@formbricks/lib/shortUrl/service";
import { canUserAccessSurvey, verifyUserRoleAccess } from "@formbricks/lib/survey/auth";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { deleteSurvey, duplicateSurvey, getSurvey } from "@formbricks/lib/survey/service";
import { createTeam, getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { AuthenticationError, AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";

export const createShortUrlAction = async (url: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthenticationError("Not authenticated");

  const regexPattern = new RegExp("^" + WEBAPP_URL);
  const isValidUrl = regexPattern.test(url);

  if (!isValidUrl) throw new Error("Only Formbricks survey URLs are allowed");

  const shortUrl = await createShortUrl(url);
  const fullShortUrl = SHORT_URL_BASE + "/" + shortUrl.id;
  return fullShortUrl;
};

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

  await createProduct(newTeam.id, {
    name: "My Product",
  });

  return newTeam;
}

export async function duplicateSurveyAction(environmentId: string, surveyId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const duplicatedSurvey = await duplicateSurvey(environmentId, surveyId);
  return duplicatedSurvey;
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
          actionClass: true,
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
    const targetEnvironmentTrigger = await prisma.actionClass.findFirst({
      where: {
        name: trigger.actionClass.name,
        environment: {
          id: targetEnvironmentId,
        },
      },
    });
    if (!targetEnvironmentTrigger) {
      // if the trigger does not exist in the target environment, create it
      const newTrigger = await prisma.actionClass.create({
        data: {
          name: trigger.actionClass.name,
          environment: {
            connect: {
              id: targetEnvironmentId,
            },
          },
          description: trigger.actionClass.description,
          type: trigger.actionClass.type,
          noCodeConfig: trigger.actionClass.noCodeConfig
            ? JSON.parse(JSON.stringify(trigger.actionClass.noCodeConfig))
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

  // if the userSegment exists in the target environment, connect it
  // otherwise, create it

  // let newUserSegment: TUserSegment | null = null;

  // if (existingSurvey.userSegmentId) {
  //   const existingUserSegment = await prisma.userSegment.findFirst({
  //     where: {
  //       id: existingSurvey.userSegmentId,
  //     },
  //   });

  //   const userSegmentInTargetEnvironment = await prisma.userSegment.findFirst({
  //     where: {
  //       title: existingUserSegment?.title,
  //       filters: {
  //         path: ["filters"],
  //         equals: existingUserSegment?.filters,
  //       },
  //       environment: {
  //         id: targetEnvironmentId,
  //       },
  //     },
  //     include: {
  //       surveys: { select: { id: true } },
  //     },
  //   });

  //   console.log({ userSegmentInTargetEnvironment, existingUserSegment });

  //   if (!userSegmentInTargetEnvironment && existingUserSegment) {
  //     const createdUserSegment = await prisma.userSegment.create({
  //       data: {
  //         title: existingUserSegment.title,
  //         description: existingUserSegment?.description,
  //         filters: JSON.parse(JSON.stringify(existingUserSegment?.filters)),
  //         isPrivate: existingUserSegment.isPrivate,
  //         environment: {
  //           connect: {
  //             id: targetEnvironmentId,
  //           },
  //         },
  //       },
  //     });

  //     newUserSegment = {
  //       ...createdUserSegment,
  //       description: createdUserSegment?.description ?? "",
  //       surveys: [],
  //     };
  //   } else {
  //     newUserSegment = {
  //       ...userSegmentInTargetEnvironment,
  //       description: userSegmentInTargetEnvironment?.description ?? "",
  //       surveys: userSegmentInTargetEnvironment?.surveys.map((survey) => survey.id) ?? [],
  //     };
  //   }
  // }

  // create new survey with the data of the existing survey
  const newSurvey = await prisma.survey.create({
    // @ts-expect-error
    data: {
      ...existingSurvey,
      id: undefined, // id is auto-generated
      environmentId: undefined, // environmentId is set below
      name: `${existingSurvey.name} (copy)`,
      status: "draft",
      questions: JSON.parse(JSON.stringify(existingSurvey.questions)),
      thankYouCard: JSON.parse(JSON.stringify(existingSurvey.thankYouCard)),
      triggers: {
        create: targetEnvironmentTriggers.map((actionClassId) => ({
          actionClassId: actionClassId,
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
      singleUse: existingSurvey.singleUse ?? prismaClient.JsonNull,
      productOverwrites: existingSurvey.productOverwrites ?? prismaClient.JsonNull,
      verifyEmail: existingSurvey.verifyEmail ?? prismaClient.JsonNull,
      styling: existingSurvey.styling ?? prismaClient.JsonNull,
    },
  });

  surveyCache.revalidate({
    id: newSurvey.id,
    environmentId: targetEnvironmentId,
  });
  return newSurvey;
}

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

  // get production environment
  const productionEnvironment = product.environments.find((environment) => environment.type === "production");
  if (!productionEnvironment) throw new ResourceNotFoundError("Production environment", environmentId);

  return productionEnvironment;
};
