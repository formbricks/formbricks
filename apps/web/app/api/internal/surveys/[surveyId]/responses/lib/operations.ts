import "server-only";
import { logger } from "@formbricks/logger";
import type { TResponseFilterCriteria } from "@formbricks/types/responses";
import { requireSurveyActionAccess } from "@/app/api/internal/lib/survey-access";
import { serializeResponseCard } from "@/app/api/internal/responses/serializers";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getResponseCountBySurveyId, getResponses } from "@/lib/response/service";
import type { TSurveyResponseCountResource } from "../serializers";

/**
 * The survey's Responses page reads: a page of its responses and how many match the filter. Both are
 * reads sent as `POST` only because the filter is too large and nested for a query string; neither writes
 * anything or is audited. Each asks `survey.response_read` on the survey, as the server actions they
 * replace did, so a restricted survey (ENG-3282) and an unknown id answer the same 403.
 */

type TRequestContext = {
  authentication: TV3Authentication;
  surveyId: string;
  requestId: string;
  instance: string;
};

/** Tenant data the page reads afresh each time: the browser keeps no copy. */
const READ_CACHE = "private, no-store";

/**
 * `POST /api/internal/surveys/{surveyId}/responses/queries`: one page of the survey's responses matching
 * the filter, newest first, with their screened-in quotas and what each respondent was not shown.
 */
export async function querySurveyResponsesOperation({
  limit,
  offset,
  filterCriteria,
  ...context
}: TRequestContext & {
  limit?: number;
  offset?: number;
  filterCriteria?: TResponseFilterCriteria;
}): Promise<Response> {
  const { authentication, surveyId, requestId, instance } = context;
  const access = await requireSurveyActionAccess({
    authentication,
    surveyId,
    action: "survey.response_read",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  try {
    const responses = await getResponses(
      surveyId,
      limit,
      offset,
      filterCriteria,
      undefined,
      // The response cards on this page mark what each respondent was not shown (ENG-6936).
      { withNotShown: true }
    );
    return successResponse(responses.map(serializeResponseCard), { requestId, cache: READ_CACHE });
  } catch (error) {
    return mapV3ThrownError(error, {
      log: logger.withContext({ requestId }),
      requestId,
      instance,
      operation: "survey-responses.query",
    });
  }
}

/** `POST /api/internal/surveys/{surveyId}/responses/counts`: how many of the survey's responses match. */
export async function countSurveyResponsesOperation({
  filterCriteria,
  ...context
}: TRequestContext & { filterCriteria?: TResponseFilterCriteria }): Promise<Response> {
  const { authentication, surveyId, requestId, instance } = context;
  const access = await requireSurveyActionAccess({
    authentication,
    surveyId,
    action: "survey.response_read",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  try {
    const count = await getResponseCountBySurveyId(surveyId, filterCriteria);
    const resource: TSurveyResponseCountResource = { count };
    return successResponse(resource, { requestId, cache: READ_CACHE });
  } catch (error) {
    return mapV3ThrownError(error, {
      log: logger.withContext({ requestId }),
      requestId,
      instance,
      operation: "survey-responses.count",
    });
  }
}
