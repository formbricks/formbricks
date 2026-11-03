import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ZResponseFilterCriteria } from "@formbricks/types/responses";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import {
  problemConflict,
  problemServiceUnavailable,
  problemTooManyRequests,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import { IS_SMTP_CONFIGURED } from "@/lib/constants";
import { getJobsQueueingConfig } from "@/lib/jobs/config";
import { getOrganization } from "@/lib/organization/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { isNewReleaseWorkEnabled } from "@/lib/upgrade/compatibility";
import { loggableError } from "@/lib/utils/loggable-error";
import { checkRateLimit } from "@/modules/core/rate-limit/rate-limit";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { MAX_ATTACHMENT_FILES } from "@/modules/storage/attachment-export/constants";
import {
  createAttachmentExport,
  dispatchAttachmentExport,
  failUndispatchedAttachmentExport,
  toAttachmentExportDto,
} from "@/modules/storage/attachment-export/service";
import { collectResponseAttachments } from "@/modules/storage/lib/collect-response-attachments";
import { authorizeAttachmentExportAccess } from "./lib/authorize";

/**
 * `/api/surveys/{surveyId}/attachment-exports` — background attachment ZIP exports (ENG-6862).
 *
 * `POST` starts one: it checks the counts the way the streaming route's pre-flight does, records the
 * export and enqueues the build, then answers `202`. The build emails the requester a link to
 * `/attachment-exports/{exportId}`, which asks `…/{exportId}/download` for a presigned URL, so the
 * browser fetches the archive straight from storage and can resume an interrupted download.
 *
 * Internal and session-only, like the streaming route it replaces: the only caller is this app.
 */

const paramsSchema = z.object({
  surveyId: z.cuid2(),
});

const bodySchema = z
  .object({
    /** The response filter, matching what the CSV/Excel export sends. Absent exports every response. */
    filterCriteria: ZResponseFilterCriteria.optional(),
  })
  .strict();

export const POST = withV3ApiWrapper({
  auth: "session",
  action: "created",
  targetType: "file",
  schemas: { params: paramsSchema, body: bodySchema },
  handler: async ({ parsedInput, authentication, requestId, instance, auditLog }) => {
    const access = await authorizeAttachmentExportAccess({
      surveyId: parsedInput.params.surveyId,
      authentication,
      requestId,
      instance,
    });
    if (access.response) return access.response;
    const { survey, organizationId, workspaceId, workspaceIdForAudit, userId } = access;
    const { filterCriteria } = parsedInput.body;

    // Without a worker to build it, without email to deliver the link, or while an online upgrade still
    // has pods that would drop the job, the client falls back to the streaming route.
    if (!IS_SMTP_CONFIGURED || !getJobsQueueingConfig().enabled || !(await isNewReleaseWorkEnabled())) {
      return problemConflict(
        requestId,
        "Background attachment exports are not available right now.",
        instance,
        {
          code: "attachment_export_unavailable",
        }
      );
    }

    const organization = await getOrganization(organizationId);
    const timeZone = organization?.displayTimeZone ?? "UTC";

    const { fileCount, responseCount, exceedsMaxFiles } = await collectResponseAttachments({
      survey,
      filterCriteria,
      maxFiles: MAX_ATTACHMENT_FILES,
      timeZone,
    });

    if (exceedsMaxFiles) {
      return problemUnprocessableContent(
        requestId,
        `This export holds more than ${MAX_ATTACHMENT_FILES} files. Narrow the response filter and try again.`,
        { instance, code: "attachment_export_too_large" }
      );
    }

    if (fileCount === 0) {
      return problemUnprocessableContent(requestId, "There are no attachments to export.", {
        instance,
        code: "attachment_export_empty",
      });
    }

    // Charged after the counts, so an empty or over-cap request does not spend the allowance.
    // `checkRateLimit` rather than `applyRateLimit`: the wrapper turns a thrown error into a 500.
    const limit = await checkRateLimit(rateLimitConfigs.storage.attachmentsExport, userId);
    if (limit.ok && !limit.data.allowed) {
      return problemTooManyRequests(
        requestId,
        "Too many attachment exports. Try again shortly.",
        limit.data.retryAfter
      );
    }

    const { row, created } = await createAttachmentExport({
      surveyId: survey.id,
      workspaceId,
      requestedById: userId,
      filterCriteria,
      timeZone,
      fileCount,
      responseCount,
    });

    if (auditLog) {
      auditLog.organizationId = organizationId;
      auditLog.targetId = row.id;
      // Asking again while one is in flight returns that one; nothing new was created.
      if (!created) auditLog.action = "queried";
    }

    if (!created) {
      return successResponse(toAttachmentExportDto(row), { requestId });
    }

    try {
      await dispatchAttachmentExport(row);
    } catch (error) {
      logger.error(
        { attachmentExportId: row.id, err: loggableError(error) },
        "Failed to enqueue attachment export"
      );
      await failUndispatchedAttachmentExport(row);
      return problemServiceUnavailable(
        requestId,
        "The export could not be started. Try again shortly.",
        instance
      );
    }

    capturePostHogEvent(
      userId,
      "attachments_exported",
      {
        survey_id: survey.id,
        file_count: fileCount,
        response_count: responseCount,
        filter_applied: Boolean(filterCriteria),
        delivery: "background",
        organization_id: organizationId,
        workspace_id: workspaceIdForAudit,
      },
      { organizationId, workspaceId: workspaceIdForAudit }
    );

    return successResponse(toAttachmentExportDto(row), { requestId, status: 202 });
  },
});
