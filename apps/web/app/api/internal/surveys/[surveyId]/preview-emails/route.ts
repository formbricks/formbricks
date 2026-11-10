import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { sendSurveyPreviewEmailOperation } from "./lib/operations";
import { ZSurveyPreviewEmailParams } from "./schemas";

/** `POST /api/internal/surveys/{surveyId}/preview-emails`: email the caller the survey's email embed. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSurveyPreviewEmailParams },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    sendSurveyPreviewEmailOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      requestId,
      instance,
    }),
});
