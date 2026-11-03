import { z } from "zod";
import { logger } from "@formbricks/logger";
import { StorageErrorCode, getSignedDownloadUrl } from "@formbricks/storage";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import {
  problemConflict,
  problemGone,
  problemInternalError,
  problemNotFound,
  successResponse,
} from "@/app/api/v3/lib/response";
import { ATTACHMENT_EXPORT_DOWNLOAD_URL_TTL_SECONDS } from "@/modules/storage/attachment-export/constants";
import { buildAttachmentArchiveFileName } from "@/modules/storage/attachment-export/export-attachments";
import { getAttachmentExport } from "@/modules/storage/attachment-export/service";
import { authorizeAttachmentExportAccess } from "../../lib/authorize";

/**
 * `GET /api/surveys/{surveyId}/attachment-exports/{exportId}/download`: a presigned URL for a completed
 * export's archive. The client navigates to it, so the browser downloads straight from storage and can
 * resume an interrupted transfer against the same URL.
 *
 * Returned as JSON rather than a 302: the audit log records an entry as successful only on a 2xx, and
 * this is the request that makes respondent files leave the product, so it is the one audited as
 * `exported`. A fresh URL is minted on every call.
 */

const paramsSchema = z.object({
  surveyId: z.cuid2(),
  exportId: z.cuid2(),
});

export const GET = withV3ApiWrapper({
  auth: "session",
  action: "exported",
  targetType: "file",
  schemas: { params: paramsSchema },
  handler: async ({ parsedInput, authentication, requestId, instance, auditLog }) => {
    const access = await authorizeAttachmentExportAccess({
      surveyId: parsedInput.params.surveyId,
      authentication,
      requestId,
      instance,
    });
    if (access.response) return access.response;

    const row = await getAttachmentExport({
      id: parsedInput.params.exportId,
      surveyId: access.survey.id,
      workspaceId: access.workspaceId,
      requestedById: access.userId,
    });
    if (!row) return problemNotFound(requestId, "AttachmentExport", null, instance);

    if (auditLog) {
      auditLog.organizationId = access.organizationId;
      auditLog.targetId = row.id;
    }

    const now = new Date();
    if (row.status === "expired" || (row.expiresAt && row.expiresAt <= now)) {
      return problemGone(requestId, "This export has expired. Start a new one to download the attachments.", {
        instance,
        code: "attachment_export_expired",
      });
    }

    if (row.status !== "completed" || !row.storageKey) {
      return problemConflict(requestId, "This export is not ready to download.", instance, {
        code: "attachment_export_not_ready",
      });
    }

    // ASCII by construction (survey id and an ISO date), so no RFC 5987 `filename*` is needed.
    const fileName = buildAttachmentArchiveFileName(access.survey, row.createdAt);
    const signed = await getSignedDownloadUrl(row.storageKey, {
      expiresIn: ATTACHMENT_EXPORT_DOWNLOAD_URL_TTL_SECONDS,
      responseContentDisposition: `attachment; filename="${fileName}"`,
    });

    // The row says completed but the object is gone (deleted by hand, or lost by a bucket rule): no retry
    // brings it back, so it reads as expired and the user starts a new export.
    if (!signed.ok && signed.error.code === StorageErrorCode.FileNotFoundError) {
      logger.warn({ attachmentExportId: row.id }, "Attachment export archive is missing from storage");
      return problemGone(requestId, "This export has expired. Start a new one to download the attachments.", {
        instance,
        code: "attachment_export_expired",
      });
    }

    if (!signed.ok) {
      logger.error(
        { attachmentExportId: row.id, error: signed.error },
        "Failed to sign attachment export URL"
      );
      return problemInternalError(requestId, "The download link could not be created. Try again.", instance);
    }

    return successResponse({ url: signed.data }, { requestId });
  },
});
