import "server-only";
import { refusalResponse } from "@/app/api/internal/lib/refusal";
import { requireSurveyActionAccess } from "@/app/api/internal/lib/survey-access";
import { requireWorkspaceActionAccess } from "@/app/api/internal/lib/workspace-access";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getOrganizationIdFromWorkspaceId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { copySurveyToOtherWorkspace } from "@/modules/survey/list/lib/survey";
import type { TSurveyCopyBody } from "../schemas";
import { serializeSurveyCopy } from "../serializers";

/**
 * `POST /api/internal/surveys/{surveyId}/copies`: copy a survey into a workspace of the same organization,
 * its own included (the survey list's Duplicate and Copy…, and the summary's Duplicate). The checks of the
 * server action it replaces, in its order: the two workspaces share an organization, the caller may write
 * both, and may read the survey itself (ENG-3282); then the target workspace's state-mutation budget.
 * Audited as `copiedToOtherWorkspace` on the source survey, with the copy as the new object.
 *
 * A missing survey or workspace, one in another organization and one the caller can't reach all answer
 * the same 403. The copy's own refusals keep their reason: the target's survey limit, or custom head
 * scripts the caller may not carry over (403), and a segment filter or media the copy can't take (422).
 */
export async function copySurveyOperation({
  authentication,
  surveyId,
  body,
  requestId,
  instance,
  auditLog,
}: {
  authentication: TV3Authentication;
  surveyId: string;
  body: TSurveyCopyBody;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  const { targetWorkspaceId } = body;

  // Each throws `ResourceNotFoundError` for an unknown id: the wrapper's uniform 403.
  const sourceWorkspaceId = await getWorkspaceIdFromSurveyId(surveyId);
  const sourceOrganizationId = await getOrganizationIdFromWorkspaceId(sourceWorkspaceId);
  const targetOrganizationId = await getOrganizationIdFromWorkspaceId(targetWorkspaceId);

  if (sourceOrganizationId !== targetOrganizationId) {
    return problemForbidden(requestId, undefined, instance);
  }

  for (const workspaceId of [sourceWorkspaceId, targetWorkspaceId]) {
    const access = await requireWorkspaceActionAccess({
      authentication,
      workspaceId,
      action: "workspace.write",
      requestId,
      instance,
    });
    if (access instanceof Response) return access;
  }

  // A copy carries the whole survey, and workspace write does not reach a restricted survey (ENG-3282).
  const surveyAccess = await requireSurveyActionAccess({
    authentication,
    surveyId,
    action: "survey.read",
    requestId,
    instance,
  });
  if (surveyAccess instanceof Response) return surveyAccess;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, targetWorkspaceId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  if (auditLog) {
    auditLog.organizationId = sourceOrganizationId;
    auditLog.targetId = surveyId;
  }

  let copy: Awaited<ReturnType<typeof copySurveyToOtherWorkspace>>;
  try {
    copy = await copySurveyToOtherWorkspace(
      sourceWorkspaceId,
      surveyId,
      targetWorkspaceId,
      surveyAccess.userId
    );
  } catch (error) {
    const refused = refusalResponse(error, requestId, instance);
    if (refused) return refused;
    throw error;
  }

  if (auditLog) auditLog.newObject = copy;
  return successResponse(serializeSurveyCopy(copy), { requestId, status: 201 });
}
