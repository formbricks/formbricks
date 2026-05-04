"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import {
  createFeedbackRecordDirectory,
  getFeedbackRecordDirectoryDetails,
  getOrganizationIdFromDirectoryId,
  updateFeedbackRecordDirectory,
} from "@/modules/ee/feedback-record-directory/lib/feedback-record-directory";
import { ZFeedbackRecordDirectoryUpdateInput } from "@/modules/ee/feedback-record-directory/types/feedback-record-directory";
import { getIsFeedbackRecordDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";

const checkFeedbackRecordDirectoriesEnabled = async (organizationId: string) => {
  const isAllowed = await getIsFeedbackRecordDirectoriesEnabled(organizationId);
  if (!isAllowed) {
    throw new OperationNotAllowedError("Feedback Record Directories are not enabled for this organization");
  }
};

const ZCreateFeedbackRecordDirectoryAction = z.object({
  organizationId: ZId,
  name: z.string().trim().min(1, "DIRECTORY_NAME_REQUIRED"),
  workspaceIds: z.array(ZId).optional(),
});

export const createFeedbackRecordDirectoryAction = authenticatedActionClient
  .inputSchema(ZCreateFeedbackRecordDirectoryAction)
  .action(
    withAuditLogging("created", "feedbackRecordDirectory", async ({ ctx, parsedInput }) => {
      await checkFeedbackRecordDirectoriesEnabled(parsedInput.organizationId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: parsedInput.organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
        ],
      });

      const result = await createFeedbackRecordDirectory(
        parsedInput.organizationId,
        parsedInput.name,
        parsedInput.workspaceIds
      );
      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
      ctx.auditLoggingCtx.feedbackRecordDirectoryId = result;
      ctx.auditLoggingCtx.newObject = {
        ...(await getFeedbackRecordDirectoryDetails(result)),
      };
      return result;
    })
  );

const ZGetFeedbackRecordDirectoryDetailsAction = z.object({
  directoryId: ZId,
});

export const getFeedbackRecordDirectoryDetailsAction = authenticatedActionClient
  .inputSchema(ZGetFeedbackRecordDirectoryDetailsAction)
  .action(async ({ parsedInput, ctx }) => {
    const organizationId = await getOrganizationIdFromDirectoryId(parsedInput.directoryId);
    await checkFeedbackRecordDirectoriesEnabled(organizationId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    return await getFeedbackRecordDirectoryDetails(parsedInput.directoryId);
  });

const ZUpdateFeedbackRecordDirectoryAction = z.object({
  directoryId: ZId,
  data: ZFeedbackRecordDirectoryUpdateInput,
  pauseConnectorsInRemovedWorkspaces: z.boolean().optional(),
});

export const updateFeedbackRecordDirectoryAction = authenticatedActionClient
  .inputSchema(ZUpdateFeedbackRecordDirectoryAction)
  .action(
    withAuditLogging("updated", "feedbackRecordDirectory", async ({ ctx, parsedInput }) => {
      const organizationId = await getOrganizationIdFromDirectoryId(parsedInput.directoryId);
      await checkFeedbackRecordDirectoriesEnabled(organizationId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.feedbackRecordDirectoryId = parsedInput.directoryId;
      const oldObject = await getFeedbackRecordDirectoryDetails(parsedInput.directoryId);
      const result = await updateFeedbackRecordDirectory(
        parsedInput.directoryId,
        organizationId,
        parsedInput.data,
        {
          pauseConnectorsInRemovedWorkspaces: parsedInput.pauseConnectorsInRemovedWorkspaces,
        }
      );
      ctx.auditLoggingCtx.oldObject = oldObject;
      ctx.auditLoggingCtx.newObject = await getFeedbackRecordDirectoryDetails(parsedInput.directoryId);
      return result;
    })
  );
