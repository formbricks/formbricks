import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { generateSingleUseLinksOperation } from "./lib/operations";
import { ZSurveySingleUseLinksBody, ZSurveySingleUseLinksParams } from "./schemas";

/** `POST /api/internal/surveys/{surveyId}/single-use-links`: mint single-use link parameters for the survey. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSurveySingleUseLinksParams, body: ZSurveySingleUseLinksBody },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    generateSingleUseLinksOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      body: parsedInput.body,
      requestId,
      instance,
    }),
});
