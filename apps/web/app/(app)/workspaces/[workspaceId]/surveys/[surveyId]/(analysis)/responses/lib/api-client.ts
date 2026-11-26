import type { TResponseFilterCriteria, TResponseWithQuotas } from "@formbricks/types/responses";
import type { TResponseCardResource } from "@/app/api/internal/responses/serializers";
import type { TSurveyResponseCountResource } from "@/app/api/internal/surveys/[surveyId]/responses/serializers";
import { reviveResponse } from "@/modules/analysis/components/SingleResponseCard/lib/api-client";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";

/**
 * The survey Responses page's reads of its responses: a page of them and how many match the filter. Both
 * are `POST /api/internal/surveys/{surveyId}/responses/…` because the filter travels in the body; neither
 * writes anything. They wait as long as the server takes, as the server actions they replace did, and
 * throw a `V3ApiError` on any failure. The responses' timestamps are revived to `Date`s here, so the table
 * and the cards keep the types the page rendered them with.
 */

const responsesPath = (surveyId: string, resource: "queries" | "counts") =>
  `/api/internal/surveys/${encodeURIComponent(surveyId)}/responses/${resource}`;

/** A page of the survey's responses matching the filter, newest first. */
export const querySurveyResponses = async ({
  surveyId,
  limit,
  offset,
  filterCriteria,
}: {
  surveyId: string;
  limit: number;
  offset: number;
  filterCriteria: TResponseFilterCriteria;
}): Promise<TResponseWithQuotas[]> => {
  const responses = await sendApiRequest<TResponseCardResource[]>(responsesPath(surveyId, "queries"), {
    method: "POST",
    body: { limit, offset, filterCriteria },
    timeoutMs: null,
  });
  return responses.map(reviveResponse);
};

/** How many of the survey's responses match the filter. `signal` is the query's cancellation. */
export const countSurveyResponses = async ({
  surveyId,
  filterCriteria,
  signal,
}: {
  surveyId: string;
  filterCriteria: TResponseFilterCriteria;
  signal?: AbortSignal;
}): Promise<number> => {
  const { count } = await sendApiRequest<TSurveyResponseCountResource>(responsesPath(surveyId, "counts"), {
    method: "POST",
    body: { filterCriteria },
    timeoutMs: null,
    signal,
  });
  return count;
};
