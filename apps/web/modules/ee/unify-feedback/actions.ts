"use server";

import { ResourceNotFoundError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import {
  assertRecordBelongsToWorkspace,
  ensureDeleteAccess,
  ensureReadAccess,
  getWorkspaceDirectoryIds,
} from "@/modules/ee/unify-feedback/lib/access";
import { deleteFeedbackRecord, retrieveFeedbackRecord } from "@/modules/hub/service";
import {
  TRetrieveFeedbackRecordAction,
  ZDeleteFeedbackRecordAction,
  ZRetrieveFeedbackRecordAction,
} from "./types";

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
        ensureReadAccess(ctx.user.id, parsedInput.workspaceId),
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
  .action(
    withAuditLogging("deleted", "feedbackRecord", async ({ ctx, parsedInput }) => {
      // Set before the access check so a refused or failed attempt is still attributable.
      ctx.auditLoggingCtx.feedbackRecordId = parsedInput.recordId;

      const [organizationId, workspaceDirectoryIds] = await Promise.all([
        ensureDeleteAccess(ctx.user.id, parsedInput.workspaceId),
        getWorkspaceDirectoryIds(parsedInput.workspaceId),
      ]);
      ctx.auditLoggingCtx.organizationId = organizationId;

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

      // Identify what was deleted without copying it: the value_* fields are end-user feedback, which
      // has no business being duplicated into the audit trail.
      ctx.auditLoggingCtx.oldObject = {
        id: currentRecordResult.data.id,
        tenant_id: currentRecordResult.data.tenant_id,
        submission_id: currentRecordResult.data.submission_id,
        source_type: currentRecordResult.data.source_type,
        source_id: currentRecordResult.data.source_id,
        field_id: currentRecordResult.data.field_id,
        field_type: currentRecordResult.data.field_type,
        collected_at: currentRecordResult.data.collected_at,
      };

      return { recordId: parsedInput.recordId };
    })
  );
