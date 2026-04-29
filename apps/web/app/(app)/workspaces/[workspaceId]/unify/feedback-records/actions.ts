"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getFeedbackRecordDirectoriesByWorkspaceId } from "@/modules/ee/feedback-record-directory/lib/feedback-record-directory";
import { createFeedbackRecord, retrieveFeedbackRecord, updateFeedbackRecord } from "@/modules/hub/service";
import type { FeedbackRecordCreateParams, FeedbackRecordUpdateParams } from "@/modules/hub/types";

const ZFeedbackRecordId = z.uuid();

const ZFeedbackRecordFieldType = z.enum([
  "text",
  "categorical",
  "nps",
  "csat",
  "ces",
  "rating",
  "number",
  "boolean",
  "date",
]);

const ZFeedbackRecordMetadata = z.record(z.string(), z.unknown());

const ZFeedbackRecordCreateInput = z.object({
  submission_id: z.string().min(1),
  tenant_id: ZId,
  source_type: z.string().min(1),
  field_id: z.string().min(1),
  field_type: ZFeedbackRecordFieldType,
  collected_at: z.iso.datetime().optional(),
  source_id: z.string().optional().nullable(),
  source_name: z.string().optional().nullable(),
  field_label: z.string().optional().nullable(),
  field_group_id: z.string().optional(),
  field_group_label: z.string().optional().nullable(),
  value_text: z.string().optional().nullable(),
  value_number: z.number().optional(),
  value_boolean: z.boolean().optional(),
  value_date: z.iso.datetime().optional(),
  metadata: ZFeedbackRecordMetadata.optional(),
  language: z.string().optional(),
  user_identifier: z.string().optional(),
});

const ZFeedbackRecordUpdateInput = z
  .object({
    value_text: z.string().optional().nullable(),
    value_number: z.number().optional().nullable(),
    value_boolean: z.boolean().optional().nullable(),
    value_date: z.iso.datetime().optional().nullable(),
    language: z.string().optional().nullable(),
    metadata: ZFeedbackRecordMetadata.optional(),
    user_identifier: z.string().optional().nullable(),
  })
  .refine(
    (value) => Object.values(value).some((entry) => entry !== undefined),
    "At least one field must be provided for update"
  );

const ZRetrieveFeedbackRecordAction = z.object({
  workspaceId: ZId,
  recordId: ZFeedbackRecordId,
});

const ZCreateFeedbackRecordAction = z.object({
  workspaceId: ZId,
  recordInput: ZFeedbackRecordCreateInput,
});

const ZUpdateFeedbackRecordAction = z.object({
  workspaceId: ZId,
  recordId: ZFeedbackRecordId,
  updateInput: ZFeedbackRecordUpdateInput,
});

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

const getWorkspaceDirectoryIds = async (workspaceId: string): Promise<Set<string>> => {
  const directories = await getFeedbackRecordDirectoriesByWorkspaceId(workspaceId);
  return new Set(directories.map((directory) => directory.id));
};

const assertRecordBelongsToWorkspace = (directoryIds: Set<string>, tenantId: string): void => {
  if (!directoryIds.has(tenantId)) {
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
      parsedInput: z.infer<typeof ZRetrieveFeedbackRecordAction>;
    }) => {
      const [, workspaceDirectoryIds] = await Promise.all([
        ensureAccess(ctx.user.id, parsedInput.workspaceId, "read"),
        getWorkspaceDirectoryIds(parsedInput.workspaceId),
      ]);

      const recordResult = await retrieveFeedbackRecord(parsedInput.recordId);
      if (!recordResult.data || recordResult.error) {
        throw new Error("Feedback record not found");
      }

      assertRecordBelongsToWorkspace(workspaceDirectoryIds, recordResult.data.tenant_id);

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
      parsedInput: z.infer<typeof ZCreateFeedbackRecordAction>;
    }) => {
      await ensureAccess(ctx.user.id, parsedInput.workspaceId, "readWrite");

      const workspaceDirectoryIds = await getWorkspaceDirectoryIds(parsedInput.workspaceId);
      assertRecordBelongsToWorkspace(workspaceDirectoryIds, parsedInput.recordInput.tenant_id);

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
      parsedInput: z.infer<typeof ZUpdateFeedbackRecordAction>;
    }) => {
      const [, workspaceDirectoryIds] = await Promise.all([
        ensureAccess(ctx.user.id, parsedInput.workspaceId, "readWrite"),
        getWorkspaceDirectoryIds(parsedInput.workspaceId),
      ]);

      const currentRecordResult = await retrieveFeedbackRecord(parsedInput.recordId);
      if (!currentRecordResult.data || currentRecordResult.error) {
        throw new Error("Feedback record not found");
      }

      assertRecordBelongsToWorkspace(workspaceDirectoryIds, currentRecordResult.data.tenant_id);

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
