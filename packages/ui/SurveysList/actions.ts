"use server";

import { Prisma as prismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import {
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromSurveyId,
} from "@formbricks/lib/organization/utils";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { segmentCache } from "@formbricks/lib/segment/cache";
import { createSegment } from "@formbricks/lib/segment/service";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { deleteSurvey, duplicateSurvey, getSurvey, getSurveys } from "@formbricks/lib/survey/service";
import { generateSurveySingleUseId } from "@formbricks/lib/utils/singleUseSurveys";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZSurveyFilterCriteria } from "@formbricks/types/surveys/types";

const ZGetSurveyAction = z.object({
  surveyId: z.string(),
});

export const getSurveyAction = authenticatedActionClient
  .schema(ZGetSurveyAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["survey", "read"],
    });

    return await getSurvey(parsedInput.surveyId);
  });

const ZDuplicateSurveyAction = z.object({
  surveyId: z.string(),
});

export const duplicateSurveyAction = authenticatedActionClient
  .schema(ZDuplicateSurveyAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["survey", "create"],
    });

    return await duplicateSurvey(parsedInput.surveyId, ctx.user.id);
  });

const ZCopyToOtherEnvironmentAction = z.object({
  environmentId: z.string(),
  surveyId: z.string(),
  targetEnvironmentId: z.string(),
});

export const copyToOtherEnvironmentAction = authenticatedActionClient
  .schema(ZCopyToOtherEnvironmentAction)
  .action(async ({ ctx, parsedInput }) => {
    // check if user has access to source and target environments
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["survey", "create"],
    });
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.targetEnvironmentId),
      rules: ["survey", "create"],
    });

    const existingSurvey = await prisma.survey.findFirst({
      where: {
        id: parsedInput.surveyId,
        environmentId: parsedInput.environmentId,
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
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
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
            id: parsedInput.targetEnvironmentId,
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
                id: parsedInput.targetEnvironmentId,
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
            id: parsedInput.targetEnvironmentId,
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
                id: parsedInput.targetEnvironmentId,
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
            id: parsedInput.targetEnvironmentId,
          },
        },
        creator: {
          connect: {
            id: ctx.user.id,
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
          environmentId: parsedInput.environmentId,
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

        segmentCache.revalidate({
          id: existingSurvey.segment.id,
          environmentId: newSurvey.environmentId,
        });
      }
    }

    surveyCache.revalidate({
      id: newSurvey.id,
      environmentId: parsedInput.targetEnvironmentId,
    });
    return newSurvey;
  });

const ZDeleteSurveyAction = z.object({
  surveyId: z.string(),
});

export const deleteSurveyAction = authenticatedActionClient
  .schema(ZDeleteSurveyAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["survey", "delete"],
    });

    await deleteSurvey(parsedInput.surveyId);
  });

const ZGenerateSingleUseIdAction = z.object({
  surveyId: z.string(),
  isEncrypted: z.boolean(),
});

export const generateSingleUseIdAction = authenticatedActionClient
  .schema(ZGenerateSingleUseIdAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["survey", "read"],
    });

    return generateSurveySingleUseId(parsedInput.isEncrypted);
  });

const ZGetSurveysAction = z.object({
  environmentId: z.string(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  filterCriteria: ZSurveyFilterCriteria.optional(),
});

export const getSurveysAction = authenticatedActionClient
  .schema(ZGetSurveysAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      data: parsedInput.filterCriteria,
      schema: ZSurveyFilterCriteria,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["survey", "read"],
    });

    return await getSurveys(
      parsedInput.environmentId,
      parsedInput.limit,
      parsedInput.offset,
      parsedInput.filterCriteria
    );
  });
