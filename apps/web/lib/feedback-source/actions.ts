"use server";

import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { AuthorizationError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TFeedbackSourceWithMappings,
  ZFeedbackSourceCreateInput,
  ZFeedbackSourceFieldMappingCreateInput,
  ZFeedbackSourceUpdateInput,
} from "@formbricks/types/feedback-source";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import {
  getOrganizationIdFromFeedbackSourceId,
  getOrganizationIdFromSurveyId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromSurveyId,
} from "@/lib/utils/helper";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getContactIdsByUserIds } from "@/modules/ee/unify-feedback/lib/contacts";
import { listFeedbackRecords } from "@/modules/hub/service";
import type { FeedbackRecordListParams, FeedbackRecordListResponse } from "@/modules/hub/types";
import { importHistoricalResponses } from "./import";
import { resolveFormbricksMappingsInput } from "./mappings";
import {
  TMappingsInput,
  createFeedbackSourceWithMappings,
  deleteFeedbackSource,
  getFeedbackSourceWithMappingsById,
  updateFeedbackSourceWithMappings,
} from "./service";
import {
  formatMissingRequiredCsvFieldMappingsMessage,
  getMissingRequiredCsvFieldMappings,
  sanitizeCsvFieldMappings,
} from "./utils";

const ZDeleteFeedbackSourceAction = z.object({
  feedbackSourceId: ZId,
  workspaceId: ZId,
});

export const deleteFeedbackSourceAction = authenticatedActionClient
  .inputSchema(ZDeleteFeedbackSourceAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZDeleteFeedbackSourceAction>;
    }) => {
      const organizationId = await getOrganizationIdFromFeedbackSourceId(parsedInput.feedbackSourceId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId: parsedInput.workspaceId,
          },
        ],
      });

      return deleteFeedbackSource(parsedInput.feedbackSourceId, parsedInput.workspaceId);
    }
  );

const ZFormbricksSurveyMapping = z.object({
  surveyId: ZId,
  elementIds: z.array(z.string()).min(1),
});

const sanitizeAndValidateCsvFieldMappings = (
  fieldMappings: z.infer<typeof ZFeedbackSourceFieldMappingCreateInput>[]
) => {
  const sanitized = sanitizeCsvFieldMappings(fieldMappings) ?? [];
  const missing = getMissingRequiredCsvFieldMappings(sanitized);

  if (missing.length > 0) {
    throw new InvalidInputError(formatMissingRequiredCsvFieldMappingsMessage());
  }

  return sanitized;
};

const ZCreateFeedbackSourceWithMappingsAction = z
  .object({
    workspaceId: ZId,
    feedbackSourceInput: ZFeedbackSourceCreateInput,
    formbricksMappings: z.array(ZFormbricksSurveyMapping).optional(),
    fieldMappings: z.array(ZFeedbackSourceFieldMappingCreateInput).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.feedbackSourceInput.type === "formbricks_survey") {
      if (!data.formbricksMappings?.length) {
        ctx.addIssue({
          code: "custom",
          path: ["formbricksMappings"],
          message: "At least one survey mapping is required for Formbricks feedbackSources",
        });
      }
    } else if (data.feedbackSourceInput.type === "csv") {
      if (!data.fieldMappings?.length) {
        ctx.addIssue({
          code: "custom",
          path: ["fieldMappings"],
          message: "At least one field mapping is required for CSV feedbackSources",
        });
      }
    }
  });

export const createFeedbackSourceWithMappingsAction = authenticatedActionClient
  .inputSchema(ZCreateFeedbackSourceWithMappingsAction)
  .action(async ({ ctx, parsedInput }): Promise<TFeedbackSourceWithMappings> => {
    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          minPermission: "readWrite",
          workspaceId: parsedInput.workspaceId,
        },
      ],
    });

    // Verify the directory belongs to the same org and is actually assigned to this workspace.
    // The composite FK enforces the assignment at the DB level too; these checks return the
    // friendlier errors first: a generic auth error for missing/cross-org directories, a typed
    // error for a same-org directory that just isn't assigned to the workspace.
    const frd = await prisma.feedbackDirectory.findUnique({
      where: { id: parsedInput.feedbackSourceInput.feedbackDirectoryId },
      select: {
        organizationId: true,
        workspaces: {
          where: { workspaceId: parsedInput.workspaceId },
          select: { workspaceId: true },
        },
      },
    });
    if (frd?.organizationId !== organizationId) {
      throw new AuthorizationError("Invalid feedback directory");
    }
    if (frd.workspaces.length === 0) {
      throw new InvalidInputError("FEEDBACK_SOURCE_DIRECTORY_NOT_ASSIGNED_TO_WORKSPACE");
    }

    let mappingsInput: TMappingsInput | undefined;

    const { formbricksMappings, fieldMappings } = parsedInput;

    if (formbricksMappings?.length) {
      mappingsInput = await resolveFormbricksMappingsInput(formbricksMappings, parsedInput.workspaceId);
    } else if (fieldMappings?.length) {
      mappingsInput = {
        type: "field",
        mappings:
          parsedInput.feedbackSourceInput.type === "csv"
            ? sanitizeAndValidateCsvFieldMappings(fieldMappings)
            : fieldMappings,
      };
    }

    return createFeedbackSourceWithMappings(
      parsedInput.workspaceId,
      { ...parsedInput.feedbackSourceInput, createdBy: ctx.user.id },
      mappingsInput
    );
  });

const ZUpdateFeedbackSourceWithMappingsAction = z.object({
  feedbackSourceId: ZId,
  workspaceId: ZId,
  feedbackSourceInput: ZFeedbackSourceUpdateInput,
  formbricksMappings: z.array(ZFormbricksSurveyMapping).min(1).optional(),
  fieldMappings: z.array(ZFeedbackSourceFieldMappingCreateInput).optional(),
});

export const updateFeedbackSourceWithMappingsAction = authenticatedActionClient
  .inputSchema(ZUpdateFeedbackSourceWithMappingsAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZUpdateFeedbackSourceWithMappingsAction>;
    }): Promise<TFeedbackSourceWithMappings> => {
      const organizationId = await getOrganizationIdFromFeedbackSourceId(parsedInput.feedbackSourceId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId: parsedInput.workspaceId,
          },
        ],
      });

      // The check above proves the caller may act in `workspaceId`; it does not prove this feedback
      // source lives there, and the organization it was authorized against came from the source
      // rather than the workspace. Pin the two together up front so every branch below — and the
      // mappings resolved against the same workspace — operates on one tenant, and so a mismatch
      // fails here rather than as a Prisma error from the update.
      const feedbackSource = await prisma.feedbackSource.findUnique({
        where: { id: parsedInput.feedbackSourceId, workspaceId: parsedInput.workspaceId },
        select: { type: true },
      });
      if (!feedbackSource) {
        throw new ResourceNotFoundError("FeedbackSource", parsedInput.feedbackSourceId);
      }

      let mappingsInput: TMappingsInput | undefined;

      if (parsedInput.formbricksMappings?.length) {
        mappingsInput = await resolveFormbricksMappingsInput(
          parsedInput.formbricksMappings,
          parsedInput.workspaceId
        );
      } else if (parsedInput.fieldMappings && parsedInput.fieldMappings.length > 0) {
        mappingsInput = {
          type: "field",
          mappings:
            feedbackSource.type === "csv"
              ? sanitizeAndValidateCsvFieldMappings(parsedInput.fieldMappings)
              : parsedInput.fieldMappings,
        };
      }

      return updateFeedbackSourceWithMappings(
        parsedInput.feedbackSourceId,
        parsedInput.workspaceId,
        parsedInput.feedbackSourceInput,
        mappingsInput
      );
    }
  );

const ZGetResponseCountAction = z.object({
  surveyId: ZId,
  workspaceId: ZId,
});

export const getResponseCountAction = authenticatedActionClient
  .inputSchema(ZGetResponseCountAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZGetResponseCountAction>;
    }): Promise<number> => {
      const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);

      // Authorize against the survey's own workspace, not the caller-supplied one: the workspaceTeam
      // check only proves team access to whatever workspace the caller names, so passing a workspace
      // they do have access to would otherwise return the response count for any survey in the org.
      const surveyWorkspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId: surveyWorkspaceId,
          },
        ],
      });

      return getResponseCountBySurveyId(parsedInput.surveyId);
    }
  );

const ZImportHistoricalResponsesAction = z.object({
  feedbackSourceId: ZId,
  workspaceId: ZId,
  surveyId: ZId,
});

export const importHistoricalResponsesAction = authenticatedActionClient
  .inputSchema(ZImportHistoricalResponsesAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZImportHistoricalResponsesAction>;
    }) => {
      const organizationId = await getOrganizationIdFromFeedbackSourceId(parsedInput.feedbackSourceId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId: parsedInput.workspaceId,
          },
        ],
      });

      const feedbackSource = await getFeedbackSourceWithMappingsById(
        parsedInput.feedbackSourceId,
        parsedInput.workspaceId
      );
      if (!feedbackSource) {
        throw new ResourceNotFoundError("FeedbackSource", parsedInput.feedbackSourceId);
      }

      const survey = await getSurvey(parsedInput.surveyId);
      if (!survey) {
        throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
      }

      // The authorization above covers the feedback source's workspace, not this survey — and the
      // import reads every response of `surveyId` and copies them into the source's feedback
      // directory. Without this check any caller with readWrite on one workspace could name a survey
      // from another organization and exfiltrate its responses into their own directory. Survey ids
      // are public (they appear in `/s/<surveyId>` links), so the id is not a secret. The picker only
      // ever offers surveys from this workspace (`getSurveysForUnifyAction` → `getSurveys(workspaceId)`).
      if (survey.workspaceId !== parsedInput.workspaceId) {
        throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
      }

      return importHistoricalResponses(feedbackSource, survey);
    }
  );

const ZListFeedbackRecordsAction = z.object({
  workspaceId: ZId,
  frdId: ZId,
  limit: z.number().min(1).max(1000).optional(),
  cursor: z.string().optional(),
  sourceType: z.string().optional(),
  fieldType: z
    .enum(["text", "categorical", "nps", "csat", "ces", "rating", "number", "boolean", "date"])
    .optional(),
  since: z.string().optional(),
  until: z.string().optional(),
});

export const listFeedbackRecordsAction = authenticatedActionClient
  .inputSchema(ZListFeedbackRecordsAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZListFeedbackRecordsAction>;
    }): Promise<FeedbackRecordListResponse> => {
      const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            minPermission: "read",
            workspaceId: parsedInput.workspaceId,
          },
        ],
      });

      // Verify FRD belongs to workspace's accessible FRDs
      const frds = await getFeedbackDirectoriesByWorkspaceId(parsedInput.workspaceId);
      if (!frds.some((f) => f.id === parsedInput.frdId)) {
        throw new Error("Feedback directory not accessible");
      }

      const params: FeedbackRecordListParams = {
        tenant_id: parsedInput.frdId,
        limit: parsedInput.limit ?? 50,
      };
      if (parsedInput.cursor) params.cursor = parsedInput.cursor;
      if (parsedInput.sourceType) params.source_type = parsedInput.sourceType;
      if (parsedInput.fieldType) params.field_type = parsedInput.fieldType;
      if (parsedInput.since) params.since = parsedInput.since;
      if (parsedInput.until) params.until = parsedInput.until;

      const result = await listFeedbackRecords(params);
      if (result.error || !result.data) {
        logger.warn({ error: result.error }, "Failed to list feedback records");
        throw new Error(result.error?.message ?? "Failed to load feedback records");
      }

      return result.data;
    }
  );

const ZGetFeedbackRecordContactsAction = z.object({
  workspaceId: ZId,
  userIds: z.array(z.string()).max(1000),
});

// Resolves a page of feedback records' user_ids to Formbricks contact ids (batched, deduped).
export const getFeedbackRecordContactsAction = authenticatedActionClient
  .inputSchema(ZGetFeedbackRecordContactsAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZGetFeedbackRecordContactsAction>;
    }): Promise<Record<string, string>> => {
      const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            minPermission: "read",
            workspaceId: parsedInput.workspaceId,
          },
        ],
      });

      return getContactIdsByUserIds(parsedInput.workspaceId, parsedInput.userIds);
    }
  );
