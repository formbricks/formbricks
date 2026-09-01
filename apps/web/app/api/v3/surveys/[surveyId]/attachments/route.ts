import { z } from "zod";
import { ZResponseFilterCriteria } from "@formbricks/types/responses";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { problemBadRequest, problemUnprocessableContent, successResponse } from "@/app/api/v3/lib/response";
import { getAuthorizedV3Survey } from "@/app/api/v3/surveys/authorization";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import { capturePostHogEvent } from "@/lib/posthog";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { collectResponseAttachments } from "@/modules/storage/lib/collect-response-attachments";
import { MAX_ATTACHMENT_FILES, streamAttachmentsAsZip } from "./lib/export-attachments";

/**
 * `GET /api/v3/surveys/{surveyId}/attachments` — the response-attachment ZIP export (ENG-1256).
 *
 * Session-only: the browser reaches it by navigating, so the cookie is the credential. Deliberately
 * absent from `docs/api-v3-reference/src/openapi.yml` — documenting an operation is what enrols it in
 * the Schemathesis contract suite, and a streaming ZIP has no JSON response schema to match.
 *
 * `dryRun=true` returns the counts as JSON instead of the archive. The client needs that because the
 * download is a plain navigation: once the 200 and its headers are flushed there is no way back to a
 * 4xx, and rendering a problem document would replace the responses table the user is looking at. So
 * the client asks first, toasts on empty or over-cap, and only then navigates.
 */

const paramsSchema = z.object({
  surveyId: z.cuid2(),
});

const querySchema = z.object({
  /**
   * The response filter, JSON-encoded, matching what the CSV/Excel export sends. A GET carries it in the
   * query string, which is why selecting individual responses is not supported here — a few hundred
   * response ids would blow past the ~8 KB a proxy accepts in a request line.
   */
  filters: z.string().optional(),
  dryRun: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const GET = withV3ApiWrapper({
  auth: "session",
  action: "exported",
  targetType: "file",
  customRateLimitConfig: rateLimitConfigs.storage.attachmentsExport,
  schemas: {
    params: paramsSchema,
    query: querySchema,
  },
  handler: async ({ parsedInput, authentication, requestId, instance, auditLog }) => {
    const { surveyId } = parsedInput.params;
    const { filters, dryRun } = parsedInput.query;

    const { survey, authResult, response } = await getAuthorizedV3Survey({
      surveyId,
      authentication,
      access: "read",
      requestId,
      instance,
    });

    if (response) return response;

    let filterCriteria;
    if (filters) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(filters);
      } catch {
        return problemBadRequest(requestId, "The `filters` parameter is not valid JSON.", {
          instance,
          invalid_params: [{ name: "filters", reason: "Expected a JSON-encoded response filter." }],
        });
      }

      const validation = ZResponseFilterCriteria.safeParse(parsed);
      if (!validation.success) {
        return problemBadRequest(requestId, "The `filters` parameter is not a valid response filter.", {
          instance,
          invalid_params: [{ name: "filters", reason: validation.error.issues[0]?.message ?? "Invalid" }],
        });
      }

      filterCriteria = validation.data;
    }

    // One pass serves both branches: the pre-flight needs the counts, the download needs the entries,
    // and the collector never opens a storage stream so there is nothing to waste by holding them.
    const { entries, fileCount, responseCount, exceedsMaxFiles } = await collectResponseAttachments({
      survey,
      filterCriteria,
      maxFiles: MAX_ATTACHMENT_FILES,
    });

    if (dryRun) {
      return successResponse(
        { fileCount, responseCount, exceedsMaxFiles, maxFiles: MAX_ATTACHMENT_FILES },
        { requestId }
      );
    }

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

    if (auditLog) {
      auditLog.organizationId = authResult.organizationId;
      auditLog.targetId = survey.id;
    }

    const sessionUserId = getSessionUserId(authentication);
    if (sessionUserId) {
      capturePostHogEvent(
        sessionUserId,
        "attachments_exported",
        {
          survey_id: survey.id,
          file_count: fileCount,
          response_count: responseCount,
          filter_applied: Boolean(filterCriteria),
          organization_id: authResult.organizationId,
          workspace_id: authResult.workspaceId,
        },
        { organizationId: authResult.organizationId, workspaceId: authResult.workspaceId }
      );
    }

    return streamAttachmentsAsZip({ entries, survey, now: new Date() });
  },
});
