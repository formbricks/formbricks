import "server-only";
import { logger } from "@formbricks/logger";
import { problemUnprocessableContent, successResponse } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getAuthorizedV3Survey } from "@/app/api/v3/surveys/authorization";
import { mapV3SurveyPatchError } from "@/app/api/v3/surveys/lib/operations";
import { serializeV3SurveyResource } from "@/app/api/v3/surveys/serializers";
import { buildVisibleSurveyWhere } from "@/lib/survey/visibility/predicate";
import {
  SurveyImportUpdateActiveError,
  updateSurveyFromFormbricksFile,
} from "@/modules/survey/formbricks-file/update";
import { toRefusalResponse } from "@/modules/survey/import/core/errors";
import type { TSurveyContentUpdateBody } from "./schemas";

const OPERATION = "surveys.content.update";

/** The 422 for an active survey, which an Update never writes, whether it was active at review or went live since. */
const problemSurveyActive = (requestId: string, instance: string): Response =>
  problemUnprocessableContent(requestId, "Active surveys cannot be updated from a file", {
    instance,
    code: "survey_active",
    invalid_params: [
      {
        name: "status",
        reason: "This survey is active. Import the file as a new survey, or pause the survey first.",
      },
    ],
  });

/**
 * `PUT /api/internal/surveys/{surveyId}/content` (ENG-6851): replace a survey's content with a reviewed
 * Formbricks file import — the Update a Match offers. Keeps the survey's id, status, responses, name,
 * settings and styling, and writes the references the content needs in the same transaction.
 *
 * - 200 with the survey's id and new `updatedAt`;
 * - 409 when the survey changed after `body.updatedAt`, with the current one in the problem's
 *   `details.currentUpdatedAt`;
 * - 422 `survey_active` for an active survey, and 422 naming each field for a file that is not valid for
 *   this survey;
 * - 403 for a survey the user cannot edit, the same as for one that does not exist.
 *
 * Idempotent through its precondition: a repeat finds the survey changed and is a 409, writing nothing.
 * Audited as `updated` on the survey, with the survey before and after.
 */
export async function updateSurveyContent({
  surveyId,
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: {
  surveyId: string;
  body: TSurveyContentUpdateBody;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  const log = logger.withContext({ requestId, surveyId, operation: OPERATION });
  let workspaceId: string | undefined;

  try {
    const { survey, authResult, response, visibility } = await getAuthorizedV3Survey({
      surveyId,
      authentication,
      access: "readWrite",
      requestId,
      instance,
    });
    if (response) {
      log.warn({ statusCode: response.status }, "Survey not found or not accessible");
      return response;
    }
    workspaceId = survey.workspaceId;

    const { before, after } = await updateSurveyFromFormbricksFile({
      survey,
      body,
      organizationId: authResult.organizationId,
      authentication,
      visibleSurveyWhere: buildVisibleSurveyWhere(visibility.actorContext),
      requestId,
    });

    if (auditLog) {
      auditLog.organizationId = authResult.organizationId;
      auditLog.targetId = after.id;
      auditLog.oldObject = serializeV3SurveyResource(before, visibility);
      auditLog.newObject = { ...serializeV3SurveyResource(after, visibility), updatedFrom: "import" };
    }
    log.info({ statusCode: 200, workspaceId, triggers: body.triggers }, "Survey updated from a file");

    return successResponse(
      { id: after.id, updatedAt: after.updatedAt.toISOString() },
      { requestId, cache: "private, no-store" }
    );
  } catch (error) {
    if (error instanceof SurveyImportUpdateActiveError) {
      log.warn({ statusCode: 422, workspaceId }, "Refused to update an active survey from a file");
      return problemSurveyActive(requestId, instance);
    }
    return (
      toRefusalResponse(error, requestId, instance) ??
      mapV3SurveyPatchError(error, { log, requestId, instance, workspaceId })
    );
  }
}
