import "server-only";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { deleteResponsesAndDisplaysForSurvey } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/survey";
import { requireSurveyActionAccess } from "@/app/api/internal/lib/survey-access";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getSurvey } from "@/lib/survey/service";
import { getOrganizationIdFromSurveyId } from "@/lib/utils/helper";
import type { TSurveyResetResource } from "../serializers";

/**
 * `POST /api/internal/surveys/{surveyId}/resets`: delete every response and display of a survey, the
 * summary's Reset. It is irreversible, so it needs `survey.manage` on the survey itself rather than the
 * write access that edits it, which keeps private surveys and pending visibility changes fail-closed
 * (ENG-3282). An archived survey is refused: the 30-day archive window exists to keep its responses.
 *
 * Audited as `updated` on the survey, with no old object and the two counts as the new one, as the server
 * action recorded it. The organization is read off the survey before the check, so a refused reset is
 * attributed to it too (the action read it off the workspace the client named).
 */
export async function resetSurveyOperation({
  authentication,
  surveyId,
  requestId,
  instance,
  auditLog,
}: {
  authentication: TV3Authentication;
  surveyId: string;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  let organizationId: string;
  try {
    organizationId = await getOrganizationIdFromSurveyId(surveyId);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) return problemForbidden(requestId, undefined, instance);
    throw error;
  }
  if (auditLog) auditLog.organizationId = organizationId;

  const access = await requireSurveyActionAccess({
    authentication,
    surveyId,
    action: "survey.manage",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  if (auditLog) {
    auditLog.targetId = surveyId;
    auditLog.oldObject = null;
  }

  // Reset is hidden while archived, but re-checked here so a stale tab or a direct call can't wipe what
  // the archive window exists to preserve.
  const survey = await getSurvey(surveyId);
  if (!survey) return problemForbidden(requestId, undefined, instance);
  if (survey.archivedAt) return problemForbidden(requestId, "Cannot reset an archived survey.", instance);

  const { deletedResponsesCount, deletedDisplaysCount } = await deleteResponsesAndDisplaysForSurvey(surveyId);
  if (auditLog) auditLog.newObject = { deletedResponsesCount, deletedDisplaysCount };

  const resource: TSurveyResetResource = { surveyId, deletedResponsesCount, deletedDisplaysCount };
  return successResponse(resource, { requestId });
}
