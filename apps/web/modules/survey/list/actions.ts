"use server";

import { z } from "zod";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import {
  getEnvironmentIdFromSurveyId,
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromSurveyId,
  getProjectIdFromSurveyId,
} from "@/lib/utils/helper";
import {
  generateSurveySingleUseLinkParams,
  generateSurveySingleUseLinkParamsList,
} from "@/lib/utils/single-use-surveys";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getProjectIdIfEnvironmentExists } from "@/modules/survey/list/lib/environment";
import { copySurveyToOtherEnvironment } from "@/modules/survey/list/lib/survey";

const ZCopySurveyToOtherEnvironmentAction = z.object({
  surveyId: z.cuid2(),
  targetEnvironmentId: z.cuid2(),
});

export const copySurveyToOtherEnvironmentAction = authenticatedActionClient
  .inputSchema(ZCopySurveyToOtherEnvironmentAction)
  .action(
    withAuditLogging("copiedToOtherEnvironment", "survey", async ({ ctx, parsedInput }) => {
      const sourceEnvironmentId = await getEnvironmentIdFromSurveyId(parsedInput.surveyId);
      const sourceEnvironmentProjectId = await getProjectIdIfEnvironmentExists(sourceEnvironmentId);
      const targetEnvironmentProjectId = await getProjectIdIfEnvironmentExists(
        parsedInput.targetEnvironmentId
      );

      if (!sourceEnvironmentProjectId || !targetEnvironmentProjectId) {
        throw new ResourceNotFoundError(
          "Environment",
          sourceEnvironmentProjectId ? parsedInput.targetEnvironmentId : sourceEnvironmentId
        );
      }

      const sourceEnvironmentOrganizationId = await getOrganizationIdFromEnvironmentId(sourceEnvironmentId);
      const targetEnvironmentOrganizationId = await getOrganizationIdFromEnvironmentId(
        parsedInput.targetEnvironmentId
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
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: sourceEnvironmentProjectId,
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
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: targetEnvironmentProjectId,
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
          type: "projectTeam",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
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
