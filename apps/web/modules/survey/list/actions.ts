"use server";

import { z } from "zod";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromWorkspaceId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import {
  generateSurveySingleUseLinkParams,
  generateSurveySingleUseLinkParamsList,
} from "@/lib/utils/single-use-surveys";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
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
      await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
        type: "workspace",
        id: sourceWorkspaceId,
      });

      // authorization check for target workspace
      await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
        type: "workspace",
        id: parsedInput.targetWorkspaceId,
      });

      // ENG-3282: a copy carries the whole survey, so the caller must be able to read the source survey
      // itself — workspace write does not reach a restricted survey. Same denial as any other refusal.
      await assertCan({ type: "user", id: ctx.user.id }, "survey.read", {
        type: "survey",
        id: parsedInput.surveyId,
      });
      await applyRateLimit(rateLimitConfigs.actions.stateMutation, parsedInput.targetWorkspaceId);

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
    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: await getWorkspaceIdFromSurveyId(parsedInput.surveyId),
    });
    // ENG-3282: the minted links write responses into this survey, as the survey summary's link actions
    // already require.
    await assertCan({ type: "user", id: ctx.user.id }, "survey.write", {
      type: "survey",
      id: parsedInput.surveyId,
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
