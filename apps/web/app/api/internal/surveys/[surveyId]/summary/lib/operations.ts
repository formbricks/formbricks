import "server-only";
import { logger } from "@formbricks/logger";
import type { TResponseFilterCriteria } from "@formbricks/types/responses";
import { getSurveySummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/surveySummary";
import { requireSurveyActionAccess } from "@/app/api/internal/lib/survey-access";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { serializeSurveySummary } from "../serializers";

/**
 * `POST /api/internal/surveys/{surveyId}/summary/queries`: the survey's summary over the responses matching
 * the filter, for the Summary page. A read sent as `POST` only because the filter is too large and nested
 * for a query string; it writes nothing and is not audited. It asks `survey.response_read` on the survey,
 * as the server action it replaces did, so a restricted survey (ENG-3282) and an unknown id answer the
 * same 403. A survey deleted after the check is a `ResourceNotFoundError`, which answers that 403 too.
 */
export async function querySurveySummaryOperation({
  authentication,
  surveyId,
  filterCriteria,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  surveyId: string;
  filterCriteria?: TResponseFilterCriteria;
  requestId: string;
  instance: string;
}): Promise<Response> {
  const access = await requireSurveyActionAccess({
    authentication,
    surveyId,
    action: "survey.response_read",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  try {
    const summary = await getSurveySummary(surveyId, filterCriteria);
    return successResponse(serializeSurveySummary(summary), { requestId, cache: "private, no-store" });
  } catch (error) {
    return mapV3ThrownError(error, {
      log: logger.withContext({ requestId }),
      requestId,
      instance,
      operation: "survey-summary.query",
    });
  }
}
