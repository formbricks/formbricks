import "server-only";
import { generateExampleResponseDataset } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/example-responses";
import { persistExampleResponseDataset } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/example-responses-persistence";
import { forbidOnRefusal } from "@/app/api/internal/lib/refusal";
import { requireSurveyActionAccess } from "@/app/api/internal/lib/survey-access";
import { getV3SessionUserId } from "@/app/api/v3/lib/auth";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  problemForbidden,
  problemUnauthorized,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { assertOrganizationAIConfigured } from "@/lib/ai/service";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { getOrganizationIdFromSurveyId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TSurveyExampleResponsesResource } from "../serializers";

/**
 * `POST /api/internal/surveys/{surveyId}/example-responses`: write a small set of LLM-authored example
 * responses into a survey that has none yet, the summary's Generate examples. Only the transport moved:
 * the checks are the server action's, in its order.
 *
 * 1. The caller's own budget (1 per minute), first: it closes the multi-click race in which two clicks pass
 *    the zero-response check before the first LLM call returns, and bounds one user's LLM spend.
 * 2. `survey.write` on the survey.
 * 3. The organization's AI gate (entitled, switched on, instance configured): 403 with its error code.
 * 4. The survey is not archived and has no responses: 403 with the reason. The button is hidden in both
 *    cases; this is the stale-tab defence.
 *
 * Audited as `updated` on the survey, failures included, with the number of responses written as the new
 * object. The write is all-or-nothing, so a failed attempt leaves the survey eligible for another.
 */
export async function generateExampleResponsesOperation({
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
  const userId = getV3SessionUserId(authentication);
  if (!userId) return problemUnauthorized(requestId, "Session required", instance);

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.generateExampleResponses, userId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  // Each throws `ResourceNotFoundError` for an unknown survey: the wrapper's uniform 403.
  const organizationId = await getOrganizationIdFromSurveyId(surveyId);
  const workspaceId = await getWorkspaceIdFromSurveyId(surveyId);

  const access = await requireSurveyActionAccess({
    authentication,
    surveyId,
    action: "survey.write",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  // Set before the gates below, so a refused or failed attempt is attributed to the organization and survey.
  if (auditLog) {
    auditLog.organizationId = organizationId;
    auditLog.targetId = surveyId;
    auditLog.oldObject = null;
  }

  const aiUnavailable = await forbidOnRefusal(
    () => assertOrganizationAIConfigured(organizationId),
    requestId,
    instance
  );
  if (aiUnavailable) return aiUnavailable;

  const survey = await getSurvey(surveyId);
  if (!survey) return problemForbidden(requestId, undefined, instance);
  if (survey.archivedAt) {
    return problemForbidden(requestId, "Cannot generate example responses for an archived survey.", instance);
  }

  const existingCount = await getResponseCountBySurveyId(surveyId);
  if (existingCount > 0) {
    return problemForbidden(
      requestId,
      "Example responses can only be generated for a survey that has no responses yet.",
      instance
    );
  }

  const generatedDataset = await generateExampleResponseDataset({
    survey,
    organizationId,
    workspaceId,
    userId: access.userId,
  });
  if (generatedDataset.responses.length === 0) {
    return problemUnprocessableContent(
      requestId,
      "This survey doesn't contain any question types we can synthesize answers for yet.",
      { instance }
    );
  }

  const { createdCount } = await persistExampleResponseDataset({
    surveyId: survey.id,
    workspaceId,
    dataset: generatedDataset,
  });
  if (auditLog) auditLog.newObject = { createdCount };

  const resource: TSurveyExampleResponsesResource = { surveyId, createdCount };
  return successResponse(resource, { requestId, status: 201 });
}
