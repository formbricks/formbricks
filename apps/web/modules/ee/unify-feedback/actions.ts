"use server";

import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { deleteFeedbackRecord, retrieveFeedbackRecord } from "@/modules/hub/service";
import {
  TRetrieveFeedbackRecordAction,
  ZDeleteFeedbackRecordAction,
  ZRetrieveFeedbackRecordAction,
} from "./types";

const ensureAccess = async (
  userId: string,
  workspaceId: string,
  minPermission: "read" | "readWrite"
): Promise<void> => {
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
  const isFeedbackDirectoriesAllowed = await getIsFeedbackDirectoriesEnabled(organizationId);
  if (!isFeedbackDirectoriesAllowed) {
    throw new OperationNotAllowedError("Unify Feedback is not enabled for this organization");
  }
  await checkAuthorizationUpdated({
    userId,
    organizationId,
    access: [
      {
        type: "organization",
        roles: ["owner", "manager"],
      },
      {
        type: "workspaceTeam",
        minPermission,
        workspaceId,
      },
    ],
  });
};

const getWorkspaceDirectoryIds = async (workspaceId: string): Promise<Set<string>> => {
  const directories = await getFeedbackDirectoriesByWorkspaceId(workspaceId);
  return new Set(directories.map((directory) => directory.id));
};

const assertRecordBelongsToWorkspace = (
  directoryIds: Set<string>,
  tenantId: string,
  recordId: string | null
): void => {
  if (!directoryIds.has(tenantId)) {
    // Same error shape as a genuine "not found" to prevent IDOR via response differences
    throw new ResourceNotFoundError("Feedback record", recordId);
  }
};

export const retrieveFeedbackRecordAction = authenticatedActionClient
  .inputSchema(ZRetrieveFeedbackRecordAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: TRetrieveFeedbackRecordAction;
    }) => {
      const [, workspaceDirectoryIds] = await Promise.all([
        ensureAccess(ctx.user.id, parsedInput.workspaceId, "read"),
        getWorkspaceDirectoryIds(parsedInput.workspaceId),
      ]);

      const recordResult = await retrieveFeedbackRecord(parsedInput.recordId);
      if (!recordResult.data || recordResult.error) {
        throw new ResourceNotFoundError("Feedback record", parsedInput.recordId);
      }

      assertRecordBelongsToWorkspace(
        workspaceDirectoryIds,
        recordResult.data.tenant_id,
        parsedInput.recordId
      );

      return recordResult.data;
    }
  );

export const deleteFeedbackRecordAction = authenticatedActionClient
  .inputSchema(ZDeleteFeedbackRecordAction)
  .action(async ({ ctx, parsedInput }) => {
    const [, workspaceDirectoryIds] = await Promise.all([
      ensureAccess(ctx.user.id, parsedInput.workspaceId, "readWrite"),
      getWorkspaceDirectoryIds(parsedInput.workspaceId),
    ]);

    const currentRecordResult = await retrieveFeedbackRecord(parsedInput.recordId);
    if (!currentRecordResult.data || currentRecordResult.error) {
      throw new ResourceNotFoundError("Feedback record", parsedInput.recordId);
    }

    assertRecordBelongsToWorkspace(
      workspaceDirectoryIds,
      currentRecordResult.data.tenant_id,
      parsedInput.recordId
    );

    const deleteResult = await deleteFeedbackRecord(parsedInput.recordId);
    if (!deleteResult.data || deleteResult.error) {
      throw new Error(deleteResult.error?.message || "Failed to delete feedback record");
    }

    return { recordId: parsedInput.recordId };
  });
