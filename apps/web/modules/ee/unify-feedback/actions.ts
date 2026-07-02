"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import {
  assertCanViewDirectory,
  assertCanWriteDirectoryRecords,
} from "@/modules/ee/feedback-directory/lib/access";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { getAccessibleWorkspaceIds } from "@/modules/ee/teams/lib/roles";
import {
  createFeedbackRecord,
  deleteFeedbackRecord,
  retrieveFeedbackRecord,
  updateFeedbackRecord,
} from "@/modules/hub/service";
import type { FeedbackRecordCreateParams, FeedbackRecordUpdateParams } from "@/modules/hub/types";
import { type TFeedbackDatasetView, getFeedbackDatasetView } from "./lib/dataset-view";
import {
  TCreateFeedbackRecordAction,
  TRetrieveFeedbackRecordAction,
  TUpdateFeedbackRecordAction,
  ZCreateFeedbackRecordAction,
  ZDeleteFeedbackRecordAction,
  ZRetrieveFeedbackRecordAction,
  ZUpdateFeedbackRecordAction,
} from "./types";

/**
 * Gate the manual-record CRUD on the Unify Feedback entitlement. The record view is org-scoped, so
 * the check keys off the organization rather than a workspace's organization.
 */
const ensureFeedbackDirectoriesEnabled = async (organizationId: string): Promise<void> => {
  const isFeedbackDirectoriesAllowed = await getIsFeedbackDirectoriesEnabled(organizationId);
  if (!isFeedbackDirectoriesAllowed) {
    throw new OperationNotAllowedError("Unify Feedback is not enabled for this organization");
  }
};

/**
 * Confirms a Hub record belongs to the dataset the caller was authorized against. Throwing the same
 * {@link ResourceNotFoundError} shape as a genuine miss keeps the action from becoming an IDOR oracle
 * (a record in another tenant is indistinguishable from one that doesn't exist).
 */
const assertRecordBelongsToDirectory = (tenantId: string, directoryId: string, recordId: string): void => {
  if (tenantId !== directoryId) {
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
      await ensureFeedbackDirectoriesEnabled(parsedInput.organizationId);
      await assertCanViewDirectory(ctx.user.id, parsedInput.organizationId, parsedInput.directoryId);

      const recordResult = await retrieveFeedbackRecord(parsedInput.recordId);
      if (!recordResult.data || recordResult.error) {
        throw new ResourceNotFoundError("Feedback record", parsedInput.recordId);
      }

      assertRecordBelongsToDirectory(
        recordResult.data.tenant_id,
        parsedInput.directoryId,
        parsedInput.recordId
      );

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
      await ensureFeedbackDirectoriesEnabled(parsedInput.organizationId);
      await assertCanWriteDirectoryRecords(ctx.user.id, parsedInput.organizationId, parsedInput.directoryId);

      // The record must be written into the dataset the caller was authorized against.
      assertRecordBelongsToDirectory(parsedInput.recordInput.tenant_id, parsedInput.directoryId, "");

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
        user_id: recordInput.user_id,
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
      await ensureFeedbackDirectoriesEnabled(parsedInput.organizationId);
      await assertCanWriteDirectoryRecords(ctx.user.id, parsedInput.organizationId, parsedInput.directoryId);

      const currentRecordResult = await retrieveFeedbackRecord(parsedInput.recordId);
      if (!currentRecordResult.data || currentRecordResult.error) {
        throw new ResourceNotFoundError("Feedback record", parsedInput.recordId);
      }

      assertRecordBelongsToDirectory(
        currentRecordResult.data.tenant_id,
        parsedInput.directoryId,
        parsedInput.recordId
      );

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
        ...(updateInput.user_id !== undefined && {
          user_id: updateInput.user_id ?? undefined,
        }),
      };

      const updateResult = await updateFeedbackRecord(parsedInput.recordId, updateParams);
      if (!updateResult.data || updateResult.error) {
        throw new Error(updateResult.error?.message || "Failed to update feedback record");
      }

      return updateResult.data;
    }
  );

export const deleteFeedbackRecordAction = authenticatedActionClient
  .inputSchema(ZDeleteFeedbackRecordAction)
  .action(async ({ ctx, parsedInput }) => {
    await ensureFeedbackDirectoriesEnabled(parsedInput.organizationId);
    await assertCanWriteDirectoryRecords(ctx.user.id, parsedInput.organizationId, parsedInput.directoryId);

    const currentRecordResult = await retrieveFeedbackRecord(parsedInput.recordId);
    if (!currentRecordResult.data || currentRecordResult.error) {
      throw new ResourceNotFoundError("Feedback record", parsedInput.recordId);
    }

    assertRecordBelongsToDirectory(
      currentRecordResult.data.tenant_id,
      parsedInput.directoryId,
      parsedInput.recordId
    );

    const deleteResult = await deleteFeedbackRecord(parsedInput.recordId);
    if (!deleteResult.data || deleteResult.error) {
      throw new Error(deleteResult.error?.message || "Failed to delete feedback record");
    }

    return { recordId: parsedInput.recordId };
  });

const ZResolveSurveyWorkspaceAction = z.object({
  organizationId: ZId,
  surveyId: ZId,
});

/**
 * Resolves a Formbricks survey (a record's `source_id`) to its owning workspace and whether the
 * caller can reach it (decision #6). The Records view is org-scoped, so a per-row survey deep-link
 * must resolve the record's OWN workspace and only link when the viewer can access it — otherwise the
 * source name renders as plain text. Used for load-more rows; the initial SSR page precomputes a map.
 *
 * Returns `{ workspaceId: null, accessible: false }` (rather than throwing) when the survey is gone
 * or lives in another organization, so an unresolvable link degrades to plain text without leaking.
 */
export const resolveSurveyWorkspaceAction = authenticatedActionClient
  .inputSchema(ZResolveSurveyWorkspaceAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZResolveSurveyWorkspaceAction>;
    }): Promise<{ workspaceId: string | null; accessible: boolean }> => {
      const membership = await getMembershipByUserIdOrganizationId(ctx.user.id, parsedInput.organizationId);
      if (!membership) {
        return { workspaceId: null, accessible: false };
      }

      let workspaceId: string;
      try {
        workspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);
      } catch {
        return { workspaceId: null, accessible: false };
      }

      const accessibleWorkspaceIds = await getAccessibleWorkspaceIds(ctx.user.id, parsedInput.organizationId);
      const accessible = accessibleWorkspaceIds.includes(workspaceId);

      // A survey in a workspace the viewer can't reach (including a different org) is not linkable.
      return { workspaceId: accessible ? workspaceId : null, accessible };
    }
  );

const ZGetFeedbackDatasetViewAction = z.object({
  organizationId: ZId,
  directoryId: ZId,
});

/**
 * Loads the full view bundle (first page of records + overview stats + source-filter options +
 * survey deep-link map) for a dataset. Backs client-side dataset switches so the overview header,
 * filters, and links all stay consistent with the records in view — the SSR page assembles the same
 * bundle for the default dataset. VIEW-guarded, so a member can only load datasets they can reach.
 */
export const getFeedbackDatasetViewAction = authenticatedActionClient
  .inputSchema(ZGetFeedbackDatasetViewAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZGetFeedbackDatasetViewAction>;
    }): Promise<TFeedbackDatasetView> => {
      await ensureFeedbackDirectoriesEnabled(parsedInput.organizationId);
      await assertCanViewDirectory(ctx.user.id, parsedInput.organizationId, parsedInput.directoryId);

      return getFeedbackDatasetView(ctx.user.id, parsedInput.organizationId, parsedInput.directoryId);
    }
  );
