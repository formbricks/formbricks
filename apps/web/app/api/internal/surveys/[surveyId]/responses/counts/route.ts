import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { countSurveyResponsesOperation } from "../lib/operations";
import { ZSurveyResponseCountBody, ZSurveyResponsesParams } from "../schemas";

/**
 * `POST /api/internal/surveys/{surveyId}/responses/counts`: how many of the survey's responses match a
 * response filter, for the Responses page's toolbar. A read: `POST` only carries the filter, which is too
 * large and nested for a query string. It changes nothing and is not audited.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSurveyResponsesParams, body: ZSurveyResponseCountBody },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    countSurveyResponsesOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      filterCriteria: parsedInput.body.filterCriteria,
      requestId,
      instance,
    }),
});
