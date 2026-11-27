import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { removeSurveySlugOperation, updateSurveySlugOperation } from "./lib/operations";
import { ZSurveySlugParams, ZSurveySlugPutBody } from "./schemas";

/** `PUT /api/internal/surveys/{surveyId}/slug`: the share modal's Pretty URL. Self-hosted only. */
export const PUT = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSurveySlugParams, body: ZSurveySlugPutBody },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    updateSurveySlugOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      body: parsedInput.body,
      requestId,
      instance,
    }),
});

/** `DELETE /api/internal/surveys/{surveyId}/slug`: remove the survey's Pretty URL. Self-hosted only. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSurveySlugParams },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    removeSurveySlugOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      requestId,
      instance,
    }),
});
