"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import {
  createFeedbackDirectory,
  getFeedbackDirectoryDetails,
  getOrganizationIdFromDirectoryId,
  updateFeedbackDirectory,
} from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { ZFeedbackDirectoryUpdateInput } from "@/modules/ee/feedback-directory/types/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";

const checkFeedbackDirectoriesEnabled = async (organizationId: string) => {
  const isAllowed = await getIsFeedbackDirectoriesEnabled(organizationId);
  if (!isAllowed) {
    throw new OperationNotAllowedError("Feedback Directories are not enabled for this organization");
  }
};

const ZCreateFeedbackDirectoryAction = z.object({
  organizationId: ZId,
  name: z.string().trim().min(1, "DIRECTORY_NAME_REQUIRED"),
  workspaceIds: z.array(ZId).optional(),
});

export const createFeedbackDirectoryAction = authenticatedActionClient
  .inputSchema(ZCreateFeedbackDirectoryAction)
  .action(
    withAuditLogging("created", "feedbackDirectory", async ({ ctx, parsedInput }) => {
      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
      await applyRateLimit(rateLimitConfigs.actions.feedbackDirectoryMutation, ctx.user.id);
      await checkFeedbackDirectoriesEnabled(parsedInput.organizationId);
      await assertCan({ type: "user", id: ctx.user.id }, "organization.manage", {
        type: "organization",
        id: parsedInput.organizationId,
      });

      const result = await createFeedbackDirectory(
        parsedInput.organizationId,
        parsedInput.name,
        parsedInput.workspaceIds
      );
      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
      ctx.auditLoggingCtx.feedbackDirectoryId = result;
      ctx.auditLoggingCtx.newObject = {
        ...(await getFeedbackDirectoryDetails(result)),
      };
      capturePostHogEvent(
        ctx.user.id,
        "feedback_directory_created",
        { feedback_directory_id: result },
        { organizationId: parsedInput.organizationId }
      );
      return result;
    })
  );

const ZGetFeedbackDirectoryDetailsAction = z.object({
  directoryId: ZId,
});

export const getFeedbackDirectoryDetailsAction = authenticatedActionClient
  .inputSchema(ZGetFeedbackDirectoryDetailsAction)
  .action(async ({ parsedInput, ctx }) => {
    const organizationId = await getOrganizationIdFromDirectoryId(parsedInput.directoryId);
    await checkFeedbackDirectoriesEnabled(organizationId);

    await assertCan({ type: "user", id: ctx.user.id }, "organization.manage", {
      type: "organization",
      id: organizationId,
    });

    return await getFeedbackDirectoryDetails(parsedInput.directoryId);
  });

const ZUpdateFeedbackDirectoryAction = z.object({
  directoryId: ZId,
  data: ZFeedbackDirectoryUpdateInput,
});

export const updateFeedbackDirectoryAction = authenticatedActionClient
  .inputSchema(ZUpdateFeedbackDirectoryAction)
  .action(
    withAuditLogging("updated", "feedbackDirectory", async ({ ctx, parsedInput }) => {
      ctx.auditLoggingCtx.feedbackDirectoryId = parsedInput.directoryId;
      await applyRateLimit(rateLimitConfigs.actions.feedbackDirectoryMutation, ctx.user.id);
      const organizationId = await getOrganizationIdFromDirectoryId(parsedInput.directoryId);
      await checkFeedbackDirectoriesEnabled(organizationId);

      await assertCan({ type: "user", id: ctx.user.id }, "organization.manage", {
        type: "organization",
        id: organizationId,
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.feedbackDirectoryId = parsedInput.directoryId;
      const oldObject = await getFeedbackDirectoryDetails(parsedInput.directoryId);
      const result = await updateFeedbackDirectory(parsedInput.directoryId, organizationId, parsedInput.data);
      ctx.auditLoggingCtx.oldObject = oldObject;
      ctx.auditLoggingCtx.newObject = await getFeedbackDirectoryDetails(parsedInput.directoryId);
      return result;
    })
  );
