"use server";

import { z } from "zod";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZSurveyFilterCriteria } from "@formbricks/types/surveys/types";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import {
  getOrganizationIdFromSurveyId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromSurveyId,
} from "@/lib/utils/helper";
import { generateSurveySingleUseIds } from "@/lib/utils/single-use-surveys";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import {
  copySurveyToOtherWorkspace,
  deleteSurvey,
  getSurvey,
  getSurveys,
} from "@/modules/survey/list/lib/survey";
import { getUserWorkspaces } from "@/modules/survey/list/lib/workspace";

const ZGetSurveyAction = z.object({
  surveyId: z.cuid2(),
});

export const getSurveyAction = authenticatedActionClient
  .inputSchema(ZGetSurveyAction)
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
          minPermission: "read",
          workspaceId: await getWorkspaceIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    return await getSurvey(parsedInput.surveyId);
  });

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

const ZGetWorkspacesByWorkspaceIdAction = z.object({
  workspaceId: z.cuid2(),
});

export const getWorkspacesByWorkspaceIdAction = authenticatedActionClient
  .inputSchema(ZGetWorkspacesByWorkspaceIdAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);
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
          minPermission: "readWrite",
          workspaceId: parsedInput.workspaceId,
        },
      ],
    });

    return await getUserWorkspaces(ctx.user.id, organizationId);
  });

const ZDeleteSurveyAction = z.object({
  surveyId: z.cuid2(),
});

export const deleteSurveyAction = authenticatedActionClient.inputSchema(ZDeleteSurveyAction).action(
  withAuditLogging("deleted", "survey", async ({ ctx, parsedInput }) => {
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

    ctx.auditLoggingCtx.organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    ctx.auditLoggingCtx.surveyId = parsedInput.surveyId;
    ctx.auditLoggingCtx.oldObject = await getSurvey(parsedInput.surveyId);
    return await deleteSurvey(parsedInput.surveyId);
  })
);

const ZGenerateSingleUseIdAction = z.object({
  surveyId: z.cuid2(),
  isEncrypted: z.boolean(),
  count: z.number().min(1).max(5000).prefault(1),
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

    return generateSurveySingleUseIds(parsedInput.count, parsedInput.isEncrypted);
  });

const ZGetSurveysAction = z.object({
  workspaceId: z.cuid2(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  filterCriteria: ZSurveyFilterCriteria.optional(),
});

export const getSurveysAction = authenticatedActionClient
  .inputSchema(ZGetSurveysAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          data: parsedInput.filterCriteria,
          schema: ZSurveyFilterCriteria,
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          minPermission: "read",
          workspaceId: parsedInput.workspaceId,
        },
      ],
    });

    return await getSurveys(
      parsedInput.workspaceId,
      parsedInput.limit,
      parsedInput.offset,
      parsedInput.filterCriteria
    );
  });
