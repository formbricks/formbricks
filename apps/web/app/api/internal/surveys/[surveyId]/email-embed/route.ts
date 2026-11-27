import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getSurveyEmailEmbedOperation } from "./lib/operations";
import { ZSurveyEmailEmbedParams } from "./schemas";

/** `GET /api/internal/surveys/{surveyId}/email-embed`: the survey rendered as an email body. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSurveyEmailEmbedParams },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getSurveyEmailEmbedOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      requestId,
      instance,
    }),
});
