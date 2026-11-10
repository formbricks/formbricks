import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { updateSingleUseSettingsOperation } from "./lib/operations";
import { ZSurveySingleUseSettingsBody, ZSurveySingleUseSettingsParams } from "./schemas";

/** `PUT /api/internal/surveys/{surveyId}/single-use-settings`: switch the survey's single-use link settings. */
export const PUT = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSurveySingleUseSettingsParams, body: ZSurveySingleUseSettingsBody },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    updateSingleUseSettingsOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      body: parsedInput.body,
      requestId,
      instance,
    }),
});
