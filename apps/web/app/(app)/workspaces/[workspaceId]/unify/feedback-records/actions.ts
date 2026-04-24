"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { AuthorizationError } from "@formbricks/types/errors";
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

const assertWorkspaceDirectoryAccess = (directoryIds: Set<string>, tenantId: string): void => {
  if (!directoryIds.has(tenantId)) {
    throw new AuthorizationError("Invalid feedback record directory for this workspace");
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
      await ensureAccess(ctx.user.id, parsedInput.workspaceId, "read");

      const recordResult = await retrieveFeedbackRecord(parsedInput.recordId);
      if (!recordResult.data || recordResult.error) {
        throw new Error(recordResult.error?.message || "Failed to retrieve feedback record");
      }

      const workspaceDirectoryIds = await getWorkspaceDirectoryIds(parsedInput.workspaceId);
      assertWorkspaceDirectoryAccess(workspaceDirectoryIds, recordResult.data.tenant_id);

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
      assertWorkspaceDirectoryAccess(workspaceDirectoryIds, parsedInput.recordInput.tenant_id);

      const createResult = await createFeedbackRecord(
        parsedInput.recordInput as unknown as FeedbackRecordCreateParams
      );
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
      await ensureAccess(ctx.user.id, parsedInput.workspaceId, "readWrite");

      const currentRecordResult = await retrieveFeedbackRecord(parsedInput.recordId);
      if (!currentRecordResult.data || currentRecordResult.error) {
        throw new Error(currentRecordResult.error?.message || "Failed to retrieve feedback record");
      }

      const workspaceDirectoryIds = await getWorkspaceDirectoryIds(parsedInput.workspaceId);
      assertWorkspaceDirectoryAccess(workspaceDirectoryIds, currentRecordResult.data.tenant_id);

      const updatePayload = Object.fromEntries(
        Object.entries(parsedInput.updateInput).filter(([, value]) => value !== undefined)
      ) as unknown as FeedbackRecordUpdateParams;

      const updateResult = await updateFeedbackRecord(parsedInput.recordId, updatePayload);
      if (!updateResult.data || updateResult.error) {
        throw new Error(updateResult.error?.message || "Failed to update feedback record");
      }

      return updateResult.data;
    }
  );
