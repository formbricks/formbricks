import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { querySurveySummaryOperation } from "../lib/operations";
import { ZSurveySummaryParams, ZSurveySummaryQueryBody } from "../schemas";

/**
 * `POST /api/internal/surveys/{surveyId}/summary/queries`: the survey's summary over the responses matching
 * a response filter, for the Summary page. A read: `POST` only carries the filter, which is too large and
 * nested for a query string. It changes nothing and is not audited.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSurveySummaryParams, body: ZSurveySummaryQueryBody },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    querySurveySummaryOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      filterCriteria: parsedInput.body.filterCriteria,
      requestId,
      instance,
    }),
});
