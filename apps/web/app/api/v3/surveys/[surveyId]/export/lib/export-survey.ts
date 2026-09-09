import "server-only";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import {
  problemInternalError,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getAuthorizedV3Survey } from "@/app/api/v3/surveys/authorization";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import { APP_VERSION, WEBAPP_URL } from "@/lib/constants";
import { capturePostHogEvent } from "@/lib/posthog";
import { buildSurveyExportEnvelope } from "@/modules/survey/export/build-export-envelope";

type TExportV3SurveyParams = {
  surveyId: string;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

/**
 * `GET /api/v3/surveys/{surveyId}/export` — the portable export envelope for one survey.
 *
 * Read access is enough: the envelope contains nothing the survey page does not show. The body is the
 * envelope under `data`; the client turns it into a file. A survey the builder refuses (empty, or one
 * that would not re-import) answers 422 with the same `invalid_params` shape the create route uses.
 */
export async function exportV3Survey({
  surveyId,
  authentication,
  requestId,
  instance,
  auditLog,
}: TExportV3SurveyParams): Promise<Response> {
  const log = logger.withContext({ requestId, surveyId });

  try {
    const { survey, authResult, response } = await getAuthorizedV3Survey({
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

    const result = buildSurveyExportEnvelope(survey, { appVersion: APP_VERSION, publicUrl: WEBAPP_URL });

    if (!result.ok) {
      log.warn({ statusCode: 422, invalidParams: result.error }, "Survey cannot be exported");
      return problemUnprocessableContent(requestId, "Survey cannot be exported in its current state", {
        invalid_params: result.error,
        instance,
      });
    }

    const envelope = result.data;

    if (auditLog) {
      auditLog.targetId = survey.id;
      auditLog.organizationId = authResult.organizationId;
      auditLog.newObject = {
        exportFormat: envelope.formbricks.exportFormat,
        workspaceId: survey.workspaceId,
        surveyId: survey.id,
        surveyType: survey.type,
      };
    }

    const sessionUserId = getSessionUserId(authentication);
    if (sessionUserId) {
      capturePostHogEvent(
        sessionUserId,
        "survey_exported",
        {
          survey_id: survey.id,
          survey_type: survey.type,
          workspace_id: authResult.workspaceId,
          organization_id: authResult.organizationId,
          question_count: envelope.survey.blocks.reduce((count, block) => count + block.elements.length, 0),
          language_count: envelope.survey.languages.length,
        },
        { organizationId: authResult.organizationId, workspaceId: authResult.workspaceId }
      );
    }

    return successResponse(envelope, { requestId, cache: "private, no-store" });
  } catch (error) {
    if (error instanceof DatabaseError) {
      log.error({ error, statusCode: 500 }, "Database error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }

    log.error({ error, statusCode: 500 }, "V3 survey export unexpected error");
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }
}
