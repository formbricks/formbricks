import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getSurveyRetentionOperation } from "./lib/operations";

/**
 * `GET /api/internal/survey-retention/{surveyId}`: the next data retention dates for one survey, the
 * count of responses already due, and its active exemptions (ENG-3695). Internal and session-only.
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: z.object({ surveyId: z.cuid2() }).strict() },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getSurveyRetentionOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      requestId,
      instance,
    }),
});
