"use server";

import { z } from "zod";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZSurveyFilterCriteria } from "@formbricks/types/surveys/types";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import {
  getEnvironmentIdFromSurveyId,
  getOrganizationIdFromSurveyId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromEnvironmentId,
  getWorkspaceIdFromSurveyId,
} from "@/lib/utils/helper";
import { generateSurveySingleUseIds } from "@/lib/utils/single-use-surveys";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getWorkspaceIdIfEnvironmentExists } from "@/modules/survey/list/lib/environment";
import {
  copySurveyToOtherEnvironment,
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

const ZCopySurveyToOtherEnvironmentAction = z.object({
  surveyId: z.cuid2(),
  targetEnvironmentId: z.cuid2(),
});

export const copySurveyToOtherEnvironmentAction = authenticatedActionClient
  .inputSchema(ZCopySurveyToOtherEnvironmentAction)
  .action(
    withAuditLogging("copiedToOtherEnvironment", "survey", async ({ ctx, parsedInput }) => {
      const sourceEnvironmentId = await getEnvironmentIdFromSurveyId(parsedInput.surveyId);
      const sourceEnvironmentWorkspaceId = await getWorkspaceIdIfEnvironmentExists(sourceEnvironmentId);
      const targetEnvironmentWorkspaceId = await getWorkspaceIdIfEnvironmentExists(
        parsedInput.targetEnvironmentId
      );

      if (!sourceEnvironmentWorkspaceId || !targetEnvironmentWorkspaceId) {
        throw new ResourceNotFoundError(
          "Environment",
          sourceEnvironmentWorkspaceId ? parsedInput.targetEnvironmentId : sourceEnvironmentId
        );
      }

      const sourceEnvironmentOrganizationId = await getOrganizationIdFromWorkspaceId(
        sourceEnvironmentWorkspaceId
      );
      const targetEnvironmentOrganizationId = await getOrganizationIdFromWorkspaceId(
        targetEnvironmentWorkspaceId
      );

      if (sourceEnvironmentOrganizationId !== targetEnvironmentOrganizationId) {
        throw new OperationNotAllowedError("Source and target environments must be in the same organization");
      }

      // authorization check for source environment
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: sourceEnvironmentOrganizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId: sourceEnvironmentWorkspaceId,
          },
        ],
      });

      // authorization check for target environment
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: targetEnvironmentOrganizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId: targetEnvironmentWorkspaceId,
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = sourceEnvironmentOrganizationId;
      ctx.auditLoggingCtx.surveyId = parsedInput.surveyId;
      const result = await copySurveyToOtherEnvironment(
        sourceEnvironmentId,
        parsedInput.surveyId,
        parsedInput.targetEnvironmentId,
        ctx.user.id
      );
      ctx.auditLoggingCtx.newObject = result;
      return result;
    })
  );

const ZGetWorkspacesByEnvironmentIdAction = z.object({
  environmentId: z.cuid2(),
});

export const getWorkspacesByEnvironmentIdAction = authenticatedActionClient
  .inputSchema(ZGetWorkspacesByEnvironmentIdAction)
  .action(async ({ ctx, parsedInput }) => {
    const workspaceId = await getWorkspaceIdFromEnvironmentId(parsedInput.environmentId);
    const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          minPermission: "readWrite",
          workspaceId,
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
  environmentId: z.cuid2(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  filterCriteria: ZSurveyFilterCriteria.optional(),
});

export const getSurveysAction = authenticatedActionClient
  .inputSchema(ZGetSurveysAction)
  .action(async ({ ctx, parsedInput }) => {
    const workspaceId = await getWorkspaceIdFromEnvironmentId(parsedInput.environmentId);
    const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
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
          workspaceId,
        },
      ],
    });

    return await getSurveys(workspaceId, parsedInput.limit, parsedInput.offset, parsedInput.filterCriteria);
  });
