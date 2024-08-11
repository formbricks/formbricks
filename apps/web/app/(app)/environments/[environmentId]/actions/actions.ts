"use server";

import { z } from "zod";
import { deleteActionClass, updateActionClass } from "@formbricks/lib/actionClass/service";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import {
  getOrganizationIdFromActionClassId,
  getOrganizationIdFromEnvironmentId,
} from "@formbricks/lib/organization/utils";
import { getSurveysByActionClassId } from "@formbricks/lib/survey/service";
import { ZActionClassInput } from "@formbricks/types/action-classes";

const ZDeleteActionClassAction = z.object({
  environmentId: z.string(),
  actionClassId: z.string(),
});

export const deleteActionClassAction = authenticatedActionClient
  .schema(ZDeleteActionClassAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromActionClassId(parsedInput.actionClassId),
      rules: ["actionClass", "delete"],
    });

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["environment", "read"],
    });

    await deleteActionClass(parsedInput.environmentId, parsedInput.actionClassId);
  });

const ZUpdateActionClassAction = z.object({
  environmentId: z.string(),
  actionClassId: z.string(),
  updatedAction: ZActionClassInput,
});

export const updateActionClassAction = authenticatedActionClient
  .schema(ZUpdateActionClassAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromActionClassId(parsedInput.actionClassId),
      rules: ["actionClass", "update"],
    });

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["environment", "read"],
    });

    return await updateActionClass(
      parsedInput.environmentId,
      parsedInput.actionClassId,
      parsedInput.updatedAction
    );
  });

const ZGetActiveInactiveSurveysAction = z.object({
  actionClassId: z.string(),
});

export const getActiveInactiveSurveysAction = authenticatedActionClient
  .schema(ZGetActiveInactiveSurveysAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromActionClassId(parsedInput.actionClassId),
      rules: ["survey", "read"],
    });

    const surveys = await getSurveysByActionClassId(parsedInput.actionClassId);
    const response = {
      activeSurveys: surveys.filter((s) => s.status === "inProgress").map((survey) => survey.name),
      inactiveSurveys: surveys.filter((s) => s.status !== "inProgress").map((survey) => survey.name),
    };
    return response;
  });
