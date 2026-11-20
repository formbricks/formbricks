import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getResponseFilterOptionsOperation } from "./lib/operations";
import { ZResponseFilterOptionsQuery } from "./schemas";

/**
 * `GET /api/internal/response-filter-options?surveyId=`: the tags, quotas and observed response values the
 * survey's Responses / Summary filter offers. Internal and session-only.
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZResponseFilterOptionsQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getResponseFilterOptionsOperation({
      authentication,
      surveyId: parsedInput.query.surveyId,
      requestId,
      instance,
    }),
});
