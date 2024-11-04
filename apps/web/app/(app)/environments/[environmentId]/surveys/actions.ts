"use server";

import { getSurvey, getSurveys } from "@/app/(app)/environments/[environmentId]/surveys/lib/surveys";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromSurveyId,
  getProductIdFromEnvironmentId,
  getProductIdFromSurveyId,
} from "@/lib/utils/helper";
import { getEnvironment } from "@/lib/utils/services";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { getProducts } from "@formbricks/lib/product/service";
import { copySurveyToOtherEnvironment, deleteSurvey } from "@formbricks/lib/survey/service";
import { generateSurveySingleUseId } from "@formbricks/lib/utils/singleUseSurveys";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZSurveyFilterCriteria } from "@formbricks/types/surveys/types";

const ZGetSurveyAction = z.object({
  surveyId: ZId,
});

export const getSurveyAction = authenticatedActionClient
  .schema(ZGetSurveyAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          rules: ["survey", "read"],
        },
        {
          type: "product",
          productId: await getProductIdFromSurveyId(parsedInput.surveyId),
        },
      ],
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
    const sourceEnvironment = await getEnvironment(parsedInput.environmentId);
    const targetEnvironment = await getEnvironment(parsedInput.targetEnvironmentId);

    if (!sourceEnvironment || !targetEnvironment) {
      throw new ResourceNotFoundError(
        "Environment",
        sourceEnvironment ? parsedInput.targetEnvironmentId : parsedInput.environmentId
      );
    }

    if (sourceEnvironment.productId !== targetEnvironment.productId) {
      throw new Error("Cannot copy survey to environment with different product");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "organization",
          rules: ["survey", "read"],
        },
        {
          type: "product",
          productId: sourceEnvironment.productId,
          minPermission: "readWrite",
        },
      ],
    });

    return await copySurveyToOtherEnvironment(
      parsedInput.environmentId,
      parsedInput.surveyId,
      parsedInput.targetEnvironmentId,
      ctx.user.id
    );
  });

const ZGetProductsByEnvironmentIdAction = z.object({
  environmentId: ZId,
});

export const getProductsByEnvironmentIdAction = authenticatedActionClient
  .schema(ZGetProductsByEnvironmentIdAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: organizationId,
      access: [
        {
          type: "organization",
          rules: ["product", "read"],
        },
      ],
    });

    // todo: add userId to getProducts
    return await getProducts(organizationId);
  });

const ZDeleteSurveyAction = z.object({
  surveyId: ZId,
});

export const deleteSurveyAction = authenticatedActionClient
  .schema(ZDeleteSurveyAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          rules: ["survey", "delete"],
        },
        {
          type: "product",
          productId: await getProductIdFromSurveyId(parsedInput.surveyId),
          minPermission: "readWrite",
        },
      ],
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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          rules: ["survey", "read"],
        },
        {
          type: "product",
          productId: await getProductIdFromSurveyId(parsedInput.surveyId),
          minPermission: "readWrite",
        },
      ],
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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          data: parsedInput.filterCriteria,
          schema: ZSurveyFilterCriteria,
          type: "organization",
          rules: ["survey", "read"],
        },
        {
          type: "product",
          productId: await getProductIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    return await getSurveys(
      parsedInput.environmentId,
      parsedInput.limit,
      parsedInput.offset,
      parsedInput.filterCriteria
    );
  });
