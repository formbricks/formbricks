"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import {
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromSurveyId,
} from "@formbricks/lib/organization/utils";
import { getProducts } from "@formbricks/lib/product/service";
import {
  copySurveyToOtherEnvironment,
  deleteSurvey,
  getSurvey,
  getSurveys,
  migrateSurveyToOtherEnvironment,
} from "@formbricks/lib/survey/service";
import { generateSurveySingleUseId } from "@formbricks/lib/utils/singleUseSurveys";
import { ZId } from "@formbricks/types/common";
import { ZSurveyFilterCriteria } from "@formbricks/types/surveys/types";

const ZGetSurveyAction = z.object({
  surveyId: ZId,
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

const ZCopySurveyToOtherEnvironmentAction = z.object({
  environmentId: ZId,
  surveyId: ZId,
  targetEnvironmentId: ZId,
});

export const copySurveyToOtherEnvironmentAction = authenticatedActionClient
  .schema(ZCopySurveyToOtherEnvironmentAction)
  .action(async ({ ctx, parsedInput }) => {
    const isSameEnvironment = parsedInput.environmentId === parsedInput.targetEnvironmentId;

    // Optimize authorization checks
    if (isSameEnvironment) {
      checkAuthorization({
        userId: ctx.user.id,
        organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
        rules: ["survey", "read"],
      });
    } else {
      checkAuthorization({
        userId: ctx.user.id,
        organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
        rules: ["survey", "read"],
      });
      checkAuthorization({
        userId: ctx.user.id,
        organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.targetEnvironmentId),
        rules: ["survey", "read"],
      });
    }

    return await copySurveyToOtherEnvironment(
      parsedInput.environmentId,
      parsedInput.surveyId,
      parsedInput.targetEnvironmentId,
      ctx.user.id
    );
  });

const ZMigrateSurveyToOtherEnvironmentAction = z.object({
  surveyId: ZId,
  targetEnvironmentId: ZId,
});

export const migrateSurveyToOtherEnvironmentAction = authenticatedActionClient
  .schema(ZMigrateSurveyToOtherEnvironmentAction)
  .action(async ({ ctx, parsedInput }) => {
    const { surveyId, targetEnvironmentId } = parsedInput;

    const survey = await getSurvey(surveyId);
    if (!survey) throw new Error("Survey not found.");
    const environmentId = survey.environmentId;

    const isSameEnvironment = environmentId === targetEnvironmentId;
    if (isSameEnvironment) {
      throw new Error("You cannot move the survey to the same product.");
    }

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(environmentId),
      rules: ["survey", "update"],
    });
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(targetEnvironmentId),
      rules: ["survey", "update"],
    });

    // Perform the migration of the survey
    return await migrateSurveyToOtherEnvironment(surveyId, environmentId, targetEnvironmentId, ctx.user.id);
  });

const ZGetProductsByEnvironmentIdAction = z.object({
  environmentId: ZId,
});

export const getProductsByEnvironmentIdAction = authenticatedActionClient
  .schema(ZGetProductsByEnvironmentIdAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: organizationId,
      rules: ["product", "read"],
    });

    return await getProducts(organizationId);
  });

const ZDeleteSurveyAction = z.object({
  surveyId: ZId,
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
  surveyId: ZId,
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
  environmentId: ZId,
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
