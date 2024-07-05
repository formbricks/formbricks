"use server";

import { Prisma as prismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { prisma } from "@formbricks/database";
import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { segmentCache } from "@formbricks/lib/segment/cache";
import { createSegment } from "@formbricks/lib/segment/service";
import { canUserAccessSurvey, verifyUserRoleAccess } from "@formbricks/lib/survey/auth";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { deleteSurvey, duplicateSurvey, getSurvey, getSurveys } from "@formbricks/lib/survey/service";
import { generateSurveySingleUseId } from "@formbricks/lib/utils/singleUseSurveys";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZProduct } from "@formbricks/types/product";
import { TSurveyFilterCriteria } from "@formbricks/types/surveys";

export const getSurveyAction = async (surveyId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await getSurvey(surveyId);
};

export const duplicateSurveyAction = async (environmentId: string, surveyId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const duplicatedSurvey = await duplicateSurvey(environmentId, surveyId, session.user.id);
  return duplicatedSurvey;
};

export const copyToOtherEnvironmentAction = async (
  environmentId: string,
  surveyId: string,
  targetEnvironmentId: string,
  productId: string
) => {
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

  const existingEnvironment = await prisma.environment.findFirst({ where: { id: environmentId } });

  if (!existingEnvironment) {
    throw new ResourceNotFoundError("Environment", environmentId);
  }

  const existingTargetEnvironment = await prisma.environment.findFirst({
    where: {
      id: targetEnvironmentId,
    },
  });

  if (!existingTargetEnvironment) {
    throw new ResourceNotFoundError("Environment", targetEnvironmentId);
  }

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
      languages: {
        select: {
          default: true,
          enabled: true,
          language: {
            select: {
              id: true,
            },
          },
        },
      },
      segment: true,
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
        ...(trigger.actionClass.type === "code"
          ? { key: trigger.actionClass.key }
          : { name: trigger.actionClass.name }),
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
          ...(trigger.actionClass.type === "code"
            ? { key: trigger.actionClass.key }
            : {
                noCodeConfig: trigger.actionClass.noCodeConfig
                  ? structuredClone(trigger.actionClass.noCodeConfig)
                  : undefined,
              }),
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

  const defaultLanguageId = existingSurvey.languages.find((l) => l.default)?.language.id;

  // create new survey with the data of the existing survey
  const newSurvey = await prisma.survey.create({
    data: {
      ...existingSurvey,
      id: undefined, // id is auto-generated
      environmentId: undefined, // environmentId is set below
      createdBy: undefined,
      segmentId: undefined,
      name: `${existingSurvey.name} (copy)`,
      status: "draft",
      questions: structuredClone(existingSurvey.questions),
      thankYouCard: structuredClone(existingSurvey.thankYouCard),
      languages: {
        create: existingSurvey.languages?.map((surveyLanguage) => ({
          languageId: surveyLanguage.language.id,
          default: surveyLanguage.language.id === defaultLanguageId,
        })),
      },
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
      creator: {
        connect: {
          id: session.user.id,
        },
      },
      surveyClosedMessage: existingSurvey.surveyClosedMessage ?? prismaClient.JsonNull,
      singleUse: existingSurvey.singleUse ?? prismaClient.JsonNull,
      productOverwrites: existingSurvey.productOverwrites ?? prismaClient.JsonNull,
      verifyEmail: existingSurvey.verifyEmail ?? prismaClient.JsonNull,
      styling: existingSurvey.styling ?? prismaClient.JsonNull,
      segment: undefined,
    },
  });

  // if the existing survey has an inline segment, we copy the filters and create a new inline segment and connect it to the new survey
  if (existingSurvey.segment) {
    if (existingSurvey.segment.isPrivate) {
      const newInlineSegment = await createSegment({
        environmentId: targetEnvironmentId,
        title: `${newSurvey.id}`,
        isPrivate: true,
        surveyId: newSurvey.id,
        filters: existingSurvey.segment.filters,
      });

      await prisma.survey.update({
        where: {
          id: newSurvey.id,
        },
        data: {
          segment: {
            connect: {
              id: newInlineSegment.id,
            },
          },
        },
      });

      segmentCache.revalidate({
        id: newInlineSegment.id,
        environmentId: newSurvey.environmentId,
      });
    } else {
      // public segment

      // if the environment and targetEnvironment are the same, we connect the copied segment to the copied survey.
      if (environmentId === targetEnvironmentId) {
        await prisma.survey.update({
          where: {
            id: newSurvey.id,
          },
          data: {
            segment: {
              connect: {
                id: existingSurvey.segment.id,
              },
            },
          },
        });
      } else {
        // if a public segment of the same name exists in the target environment, we make a new segment in the target environment and then connect the copied survey to it.
        const existingSegmentInTargetEnvironment = await prisma.segment.findFirst({
          where: {
            title: existingSurvey.segment.title,
            isPrivate: false,
            environmentId: targetEnvironmentId,
          },
        });

        await prisma.segment.create({
          data: {
            title: existingSegmentInTargetEnvironment
              ? `${existingSurvey.segment.title} (copied from environment: ${environmentId})`
              : existingSurvey.segment.title,
            environmentId: targetEnvironmentId,
            isPrivate: false,
            filters: existingSurvey.segment.filters,
            surveys: {
              connect: {
                id: newSurvey.id,
              },
            },
          },
        });
      }

      segmentCache.revalidate({
        id: existingSurvey.segment.id,
        environmentId: newSurvey.environmentId,
      });

      surveyCache.revalidate({
        id: newSurvey.id,
        environmentId: newSurvey.environmentId,
      });
    }
  }

  surveyCache.revalidate({
    id: newSurvey.id,
    environmentId: targetEnvironmentId,
  });
  // update the environment with the productId in which the survey has been copied.
  await prisma.environment.update({
    where: {
      id: targetEnvironmentId,
    },
    data: {
      productId: productId,
      surveys: {
        connect: {
          id: newSurvey.id,
        },
      },
    },
  });

  return newSurvey;
};

export const getProductSurveyAction = async (environmentId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const organization = await getOrganizationByEnvironmentId(environmentId);

  if (!organization) {
    throw new Error("No organization found");
  }

  const products = await prisma.product.findMany({
    where: {
      organizationId: organization.id,
    },
  });

  // Fetch environments for each product
  const productsWithEnvironments = await Promise.all(
    products.map(async (product) => {
      const environments = await prisma.environment.findMany({
        where: {
          productId: product.id,
        },
      });

      // Map environments to conform to ZEnvironment schema
      const mappedEnvironments = environments.map((env) => ({
        id: env.id,
        createdAt: env.createdAt,
        updatedAt: env.updatedAt,
        type: env.type, // Assuming EnvironmentType is defined correctly
        productId: env.productId,
        appSetupCompleted: env.appSetupCompleted,
        websiteSetupCompleted: env.websiteSetupCompleted,
      }));

      // Construct product with mapped environments
      const productWithEnvironments = {
        ...product,
        environments: mappedEnvironments,
      };

      console.log("Product with environments:", productWithEnvironments);

      return productWithEnvironments; // Return each product with its environments
    })
  );

  console.log("Products with environments:", productsWithEnvironments);

  return productsWithEnvironments;
};

// export const getProductSurveyAction = async (environmentId: string) => {
//   const session = await getServerSession(authOptions);
//   if (!session) throw new AuthorizationError("Not authorized");

//   const organization = await getOrganizationByEnvironmentId(environmentId);
//   console.log("Organization:", organization);

//   if (!organization) {
//     throw new Error("No organization found");
//   }

//   const products = await prisma.product.findMany({
//     where: {
//       organizationId: organization.id,
//     },
//   });

//   // Fetch environments for each product
//   const productsWithEnvironments = await Promise.all(
//     products.map(async (product) => {
//       const environments = await prisma.environment.findMany({
//         where: {
//           productId: product.id,
//         },
//       });

//       const mappedEnvironments = environments.map((env) => ({
//         id: env.id,
//         createdAt: env.createdAt,
//         updatedAt: env.updatedAt,
//         type: env.type as EnvironmentType, // Assuming EnvironmentType is defined correctly
//         productId: env.productId,
//         appSetupCompleted: env.appSetupCompleted,
//         websiteSetupCompleted: env.websiteSetupCompleted,
//       }));

//       const productWithEnvironments = {
//         ...product,
//         environments: mappedEnvironments,
//       };

//       return {
//         ...product,
//         environments: environments.map((env) => ({
//           id: env.id,
//     createdAt: env.createdAt,
//     updatedAt: env.updatedAt,
//     type: env.type,
//     productId: env.productId,
//     appSetupCompleted: env.appSetupCompleted,
//     websiteSetupCompleted: env.websiteSetupCompleted,
//         })),
//       };
//     })
//   );

//   console.log("pppppp",productsWithEnvironments);

//   return productsWithEnvironments;
// };

export const getSurveytype = async (surveyId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const findsurvey = await prisma.survey.findFirst({
    where: {
      id: surveyId,
    },
  });

  if (!findsurvey) {
    throw new ResourceNotFoundError("Survey", surveyId);
  }

  const surveytype = findsurvey?.type;

  return surveytype;
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
