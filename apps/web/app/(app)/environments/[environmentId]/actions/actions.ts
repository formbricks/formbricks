"use server";

import { z } from "zod";
import { deleteActionClass, getActionClass, updateActionClass } from "@formbricks/lib/actionClass/service";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getOrganizationIdFromActionClassId } from "@formbricks/lib/organization/utils";
import { getSurveysByActionClassId } from "@formbricks/lib/survey/service";
import { ZActionClassInput } from "@formbricks/types/action-classes";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";

const ZDeleteActionClassAction = z.object({
  actionClassId: ZId,
});

export const deleteActionClassAction = authenticatedActionClient
  .schema(ZDeleteActionClassAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromActionClassId(parsedInput.actionClassId),
      rules: ["actionClass", "delete"],
    });

    await deleteActionClass(parsedInput.actionClassId);
  });

const ZUpdateActionClassAction = z.object({
  actionClassId: ZId,
  updatedAction: ZActionClassInput,
});

export const updateActionClassAction = authenticatedActionClient
  .schema(ZUpdateActionClassAction)
  .action(async ({ ctx, parsedInput }) => {
    const actionClass = await getActionClass(parsedInput.actionClassId);
    if (actionClass === null) {
      throw new ResourceNotFoundError("ActionClass", parsedInput.actionClassId);
    }

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromActionClassId(parsedInput.actionClassId),
      rules: ["actionClass", "update"],
    });

    return await updateActionClass(
      actionClass.environmentId,
      parsedInput.actionClassId,
      parsedInput.updatedAction
    );
  });

const ZGetActiveInactiveSurveysAction = z.object({
  actionClassId: ZId,
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
