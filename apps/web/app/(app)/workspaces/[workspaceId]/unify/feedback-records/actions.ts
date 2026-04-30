"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { createFeedbackRecord, retrieveFeedbackRecord, updateFeedbackRecord } from "@/modules/hub/service";
import type { FeedbackRecordCreateParams, FeedbackRecordUpdateParams } from "@/modules/hub/types";
import {
  TCreateFeedbackRecordAction,
  TRetrieveFeedbackRecordAction,
  TUpdateFeedbackRecordAction,
  ZCreateFeedbackRecordAction,
  ZRetrieveFeedbackRecordAction,
  ZUpdateFeedbackRecordAction,
} from "./types";

const ensureAccess = async (
  userId: string,
  workspaceId: string,
  minPermission: "read" | "readWrite"
): Promise<void> => {
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
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

const assertRecordBelongsToWorkspace = (workspaceId: string, tenantId: string): void => {
  if (tenantId !== workspaceId) {
    // Throw a generic error indistinguishable from "not found" to prevent IDOR
    throw new Error("Feedback record not found");
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
      await ensureAccess(ctx.user.id, parsedInput.workspaceId, "read");

      const recordResult = await retrieveFeedbackRecord(parsedInput.recordId);
      if (!recordResult.data || recordResult.error) {
        throw new Error("Feedback record not found");
      }

      assertRecordBelongsToWorkspace(parsedInput.workspaceId, recordResult.data.tenant_id);

      return recordResult.data;
    }
  );

export const createFeedbackRecordAction = authenticatedActionClient
  .inputSchema(ZCreateFeedbackRecordAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: TCreateFeedbackRecordAction;
    }) => {
      await ensureAccess(ctx.user.id, parsedInput.workspaceId, "readWrite");

      assertRecordBelongsToWorkspace(parsedInput.workspaceId, parsedInput.recordInput.tenant_id);

      const { recordInput } = parsedInput;
      const createParams: FeedbackRecordCreateParams = {
        submission_id: recordInput.submission_id,
        tenant_id: recordInput.tenant_id,
        source_type: recordInput.source_type,
        field_id: recordInput.field_id,
        field_type: recordInput.field_type,
        collected_at: recordInput.collected_at,
        source_id: recordInput.source_id,
        source_name: recordInput.source_name,
        field_label: recordInput.field_label,
        field_group_id: recordInput.field_group_id,
        field_group_label: recordInput.field_group_label,
        value_text: recordInput.value_text,
        value_number: recordInput.value_number,
        value_boolean: recordInput.value_boolean,
        value_date: recordInput.value_date,
        metadata: recordInput.metadata,
        language: recordInput.language,
        user_identifier: recordInput.user_identifier,
      };

      const createResult = await createFeedbackRecord(createParams);
      if (!createResult.data || createResult.error) {
        throw new Error(createResult.error?.message || "Failed to create feedback record");
      }

      return createResult.data;
    }
  );

export const updateFeedbackRecordAction = authenticatedActionClient
  .inputSchema(ZUpdateFeedbackRecordAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: TUpdateFeedbackRecordAction;
    }) => {
      await ensureAccess(ctx.user.id, parsedInput.workspaceId, "readWrite");

      const currentRecordResult = await retrieveFeedbackRecord(parsedInput.recordId);
      if (!currentRecordResult.data || currentRecordResult.error) {
        throw new Error("Feedback record not found");
      }

      assertRecordBelongsToWorkspace(parsedInput.workspaceId, currentRecordResult.data.tenant_id);

      const { updateInput } = parsedInput;
      const updateParams: FeedbackRecordUpdateParams = {
        ...(updateInput.value_text !== undefined && { value_text: updateInput.value_text ?? undefined }),
        ...(updateInput.value_number !== undefined && {
          value_number: updateInput.value_number ?? undefined,
        }),
        ...(updateInput.value_boolean !== undefined && {
          value_boolean: updateInput.value_boolean ?? undefined,
        }),
        ...(updateInput.value_date !== undefined && { value_date: updateInput.value_date ?? undefined }),
        ...(updateInput.language !== undefined && { language: updateInput.language ?? undefined }),
        ...(updateInput.metadata !== undefined && { metadata: updateInput.metadata }),
        ...(updateInput.user_identifier !== undefined && {
          user_identifier: updateInput.user_identifier ?? undefined,
        }),
      };

      const updateResult = await updateFeedbackRecord(parsedInput.recordId, updateParams);
      if (!updateResult.data || updateResult.error) {
        throw new Error(updateResult.error?.message || "Failed to update feedback record");
      }

      return updateResult.data;
    }
  );
