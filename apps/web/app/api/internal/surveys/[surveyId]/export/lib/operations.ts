import "server-only";
import { logger } from "@formbricks/logger";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getAuthorizedV3Survey } from "@/app/api/v3/surveys/authorization";
import { buildAttachmentContentDisposition, buildDownloadFileName } from "@/lib/utils/content-disposition";
import { FORMBRICKS_FILE_EXTENSION, FORMBRICKS_FILE_FORMAT } from "@/modules/survey/formbricks-file/envelope";
import { exportFormbricksFile } from "@/modules/survey/formbricks-file/export";

/** The formats `?format=` takes. ENG-6849 adds `xlsx`. */
export const SURVEY_EXPORT_FORMATS = ["json"] as const;
export type TSurveyExportFormat = (typeof SURVEY_EXPORT_FORMATS)[number];

/** The name a file gets when the survey's own name leaves nothing usable. */
const FALLBACK_FILE_NAME = "survey";

/**
 * One survey as a downloadable file. Anyone who may read the survey may export it, read-only members
 * included: the file holds nothing the survey page does not show. An unknown survey and one the caller
 * may not read get the same 403, so the route cannot be used to probe for surveys.
 *
 * The body is the file's bytes, sent whole with a `Content-Length` rather than streamed: a survey body is
 * capped at 2 MB, and a client that knows the length can tell a complete download from a cut one.
 */
export async function exportSurveyOperation({
  surveyId,
  format,
  authentication,
  requestId,
  instance,
  auditLog,
}: {
  surveyId: string;
  format: TSurveyExportFormat;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  const log = logger.withContext({ requestId, surveyId, format });

  try {
    const { survey, authResult, response, visibility } = await getAuthorizedV3Survey({
      surveyId,
      authentication,
      access: "read",
      requestId,
      instance,
    });

    if (response) {
      log.warn({ statusCode: response.status }, "Survey not found or not accessible");
      return response;
    }

    const file = await exportFormbricksFile({ survey, visibility });
    const body = new TextEncoder().encode(`${JSON.stringify(file, null, 2)}\n`);
    const fileName = buildDownloadFileName(survey.name, FORMBRICKS_FILE_EXTENSION, FALLBACK_FILE_NAME);

    // Only once access is granted: a refused request must not file an event under the organization of a
    // survey the caller could not see.
    if (auditLog) {
      auditLog.organizationId = authResult.organizationId;
      auditLog.targetId = survey.id;
      auditLog.newObject = { format, fileFormat: FORMBRICKS_FILE_FORMAT, workspaceId: survey.workspaceId };
    }

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": buildAttachmentContentDisposition(fileName),
        "Content-Length": String(body.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "surveys.export" });
  }
}
