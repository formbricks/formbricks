import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listSurveyDisplaysOperation } from "./lib/operations";
import { ZSurveyDisplaysParams, ZSurveyDisplaysQuery } from "./schemas";

/**
 * `GET /api/internal/surveys/{surveyId}/displays?limit=&offset=`: a page of the survey's displays to known
 * contacts, for the Summary page's Impressions tab. Internal and session-only.
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSurveyDisplaysParams, query: ZSurveyDisplaysQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listSurveyDisplaysOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      limit: parsedInput.query.limit,
      offset: parsedInput.query.offset,
      requestId,
      instance,
    }),
});
