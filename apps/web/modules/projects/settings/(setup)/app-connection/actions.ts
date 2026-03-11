"use server";

import { z } from "zod";
import { ZActionClassInput } from "@formbricks/types/action-classes";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { deleteActionClass, getActionClass, updateActionClass } from "@/lib/actionClass/service";
import { getSurveysByActionClassId } from "@/lib/survey/service";
import { actionClient, authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromActionClassId, getProjectIdFromActionClassId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";

const ZDeleteActionClassAction = z.object({
  actionClassId: ZId,
});

export const deleteActionClassAction = authenticatedActionClient.inputSchema(ZDeleteActionClassAction).action(
  withAuditLogging("deleted", "actionClass", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromActionClassId(parsedInput.actionClassId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromActionClassId(parsedInput.actionClassId),
        },
      ],
    });
    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.actionClassId = parsedInput.actionClassId;
    ctx.auditLoggingCtx.oldObject = await getActionClass(parsedInput.actionClassId);
    return await deleteActionClass(parsedInput.actionClassId);
  })
);

const ZUpdateActionClassAction = z.object({
  actionClassId: ZId,
  updatedAction: ZActionClassInput,
});

export const updateActionClassAction = authenticatedActionClient.inputSchema(ZUpdateActionClassAction).action(
  withAuditLogging("updated", "actionClass", async ({ ctx, parsedInput }) => {
    const actionClass = await getActionClass(parsedInput.actionClassId);
    if (actionClass === null) {
      throw new ResourceNotFoundError("ActionClass", parsedInput.actionClassId);
    }

    const organizationId = await getOrganizationIdFromActionClassId(parsedInput.actionClassId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromActionClassId(parsedInput.actionClassId),
        },
      ],
    });
    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.actionClassId = parsedInput.actionClassId;
    ctx.auditLoggingCtx.oldObject = actionClass;
    const result = await updateActionClass(
      actionClass.environmentId,
      parsedInput.actionClassId,
      parsedInput.updatedAction
    );
    ctx.auditLoggingCtx.newObject = result;
    return result;
  })
);

const ZGetActiveInactiveSurveysAction = z.object({
  actionClassId: ZId,
});

export const getActiveInactiveSurveysAction = authenticatedActionClient
  .inputSchema(ZGetActiveInactiveSurveysAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromActionClassId(parsedInput.actionClassId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromActionClassId(parsedInput.actionClassId),
        },
      ],
    });

    const surveys = await getSurveysByActionClassId(parsedInput.actionClassId);
    const response = {
      activeSurveys: surveys.filter((s) => s.status === "inProgress").map((survey) => survey.name),
      inactiveSurveys: surveys.filter((s) => s.status !== "inProgress").map((survey) => survey.name),
    };
    return response;
  });

const getLatestStableFbRelease = async (): Promise<string | null> => {
  try {
    const res = await fetch("https://api.github.com/repos/formbricks/formbricks/releases/latest");
    const release = await res.json();

    if (release && release.tag_name) {
      return release.tag_name;
    }

    return null;
  } catch (error) {
    throw new Error("Failed to get latest stable Formbricks release", { cause: error });
  }
};

export const getLatestStableFbReleaseAction = actionClient.action(async () => {
  return await getLatestStableFbRelease();
});
