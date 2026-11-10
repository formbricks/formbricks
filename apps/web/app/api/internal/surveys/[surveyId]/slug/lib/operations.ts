import "server-only";
import { InvalidInputError } from "@formbricks/types/errors";
import { requireSurveyActionAccess } from "@/app/api/internal/lib/survey-access";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  noContentResponse,
  problemConflict,
  problemForbidden,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { updateSurveySlug } from "@/modules/survey/lib/slug";
import type { TSurveySlugPutBody } from "../schemas";
import { serializeSurveySlug } from "../serializers";

type TRequestContext = {
  authentication: TV3Authentication;
  surveyId: string;
  requestId: string;
  instance?: string;
};

/**
 * Set or clear a survey's slug, with the checks of the server actions this route replaces: self-hosted
 * only, `survey.write` on the survey, then the workspace's state-mutation budget. Not audited, as before.
 */
async function writeSurveySlug(
  { authentication, surveyId, requestId, instance }: TRequestContext,
  slug: string | null
): Promise<Response | { id: string; slug: string | null }> {
  if (IS_FORMBRICKS_CLOUD) {
    return problemForbidden(requestId, "Pretty URLs are only available on self-hosted instances", instance);
  }

  const access = await requireSurveyActionAccess({
    authentication,
    surveyId,
    action: "survey.write",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  // Thrown as `ResourceNotFoundError` for a survey deleted since the check: the wrapper's uniform 403.
  const workspaceId = await getWorkspaceIdFromSurveyId(surveyId);
  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, workspaceId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  try {
    return await updateSurveySlug(surveyId, slug);
  } catch (error) {
    // The one refusal `updateSurveySlug` raises as invalid input: another survey has this slug.
    if (error instanceof InvalidInputError) return problemConflict(requestId, error.message, instance);
    throw error;
  }
}

/** `PUT /api/internal/surveys/{surveyId}/slug`: give the survey a pretty URL, `/p/{slug}`. */
export async function updateSurveySlugOperation({
  body,
  ...context
}: TRequestContext & { body: TSurveySlugPutBody }): Promise<Response> {
  const result = await writeSurveySlug(context, body.slug);
  if (result instanceof Response) return result;
  return successResponse(serializeSurveySlug(result), { requestId: context.requestId });
}

/** `DELETE /api/internal/surveys/{surveyId}/slug`: remove the survey's pretty URL. */
export async function removeSurveySlugOperation(context: TRequestContext): Promise<Response> {
  const result = await writeSurveySlug(context, null);
  if (result instanceof Response) return result;
  return noContentResponse({ requestId: context.requestId });
}
