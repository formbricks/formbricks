import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { querySurveyResponsesOperation } from "../lib/operations";
import { ZSurveyResponsesParams, ZSurveyResponsesQueryBody } from "../schemas";

/**
 * `POST /api/internal/surveys/{surveyId}/responses/queries`: a page of the survey's responses matching a
 * response filter, for the Responses page. A read: `POST` only carries the filter, which is too large and
 * nested for a query string. It changes nothing and is not audited.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSurveyResponsesParams, body: ZSurveyResponsesQueryBody },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    querySurveyResponsesOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      limit: parsedInput.body.limit,
      offset: parsedInput.body.offset,
      filterCriteria: parsedInput.body.filterCriteria,
      requestId,
      instance,
    }),
});
