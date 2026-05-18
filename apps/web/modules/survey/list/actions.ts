"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import {
  getOrganizationIdFromSurveyId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromSurveyId,
} from "@/lib/utils/helper";
import {
  generateSurveySingleUseLinkParams,
  generateSurveySingleUseLinkParamsList,
} from "@/lib/utils/single-use-surveys";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { updateSurvey } from "@/modules/survey/editor/lib/survey";
import { getSurvey } from "@/modules/survey/lib/survey";
import { copySurveyToOtherWorkspace } from "@/modules/survey/list/lib/survey";

const ZCopySurveyToOtherWorkspaceAction = z.object({
  surveyId: z.cuid2(),
  targetWorkspaceId: z.cuid2(),
});

export const copySurveyToOtherWorkspaceAction = authenticatedActionClient
  .inputSchema(ZCopySurveyToOtherWorkspaceAction)
  .action(
    withAuditLogging("copiedToOtherWorkspace", "survey", async ({ ctx, parsedInput }) => {
      const sourceWorkspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);

      const sourceOrganizationId = await getOrganizationIdFromWorkspaceId(sourceWorkspaceId);
      const targetOrganizationId = await getOrganizationIdFromWorkspaceId(parsedInput.targetWorkspaceId);

      if (sourceOrganizationId !== targetOrganizationId) {
        throw new OperationNotAllowedError("Source and target workspaces must be in the same organization");
      }

      // authorization check for source workspace
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: sourceOrganizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId: sourceWorkspaceId,
          },
        ],
      });

      // authorization check for target workspace
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: targetOrganizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId: parsedInput.targetWorkspaceId,
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = sourceOrganizationId;
      ctx.auditLoggingCtx.surveyId = parsedInput.surveyId;
      const result = await copySurveyToOtherWorkspace(
        sourceWorkspaceId,
        parsedInput.surveyId,
        parsedInput.targetWorkspaceId,
        ctx.user.id
      );
      ctx.auditLoggingCtx.newObject = result;
      return result;
    })
  );

const ZUpdateSurveyStatusAction = z.object({
  surveyId: ZId,
  status: z.enum(["inProgress", "paused", "completed"]),
});

export const updateSurveyStatusAction = authenticatedActionClient
  .inputSchema(ZUpdateSurveyStatusAction)
  .action(
    withAuditLogging("updated", "survey", async ({ ctx, parsedInput }) => {
      const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
      const workspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            workspaceId,
            minPermission: "readWrite",
          },
        ],
      });

      const survey = await getSurvey(parsedInput.surveyId);

      if (survey.status === "draft") {
        throw new OperationNotAllowedError("Draft surveys must be published from the editor.");
      }

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.surveyId = parsedInput.surveyId;
      ctx.auditLoggingCtx.oldObject = survey;

      const updatedSurvey = await updateSurvey({ ...survey, status: parsedInput.status });

      ctx.auditLoggingCtx.newObject = updatedSurvey;

      revalidatePath(`/workspaces/${updatedSurvey.workspaceId}/surveys`);
      revalidatePath(`/workspaces/${updatedSurvey.workspaceId}/surveys/${updatedSurvey.id}`);

      return updatedSurvey;
    })
  );

const ZGenerateSingleUseIdAction = z
  .object({
    surveyId: z.cuid2(),
    isEncrypted: z.boolean(),
    count: z.number().min(1).max(5000).prefault(1),
    singleUseId: z.string().trim().min(1).max(255).optional(),
  })
  .refine((data) => !data.singleUseId || (!data.isEncrypted && data.count === 1), {
    message: "Custom single-use IDs can only be generated one at a time without encryption",
  });

export const generateSingleUseIdsAction = authenticatedActionClient
  .inputSchema(ZGenerateSingleUseIdAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          workspaceId: await getWorkspaceIdFromSurveyId(parsedInput.surveyId),
          minPermission: "readWrite",
        },
      ],
    });

    if (parsedInput.singleUseId) {
      return [generateSurveySingleUseLinkParams(parsedInput.surveyId, false, parsedInput.singleUseId)];
    }

    return generateSurveySingleUseLinkParamsList(
      parsedInput.count,
      parsedInput.surveyId,
      parsedInput.isEncrypted
    );
  });
