import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { generatePersonalLinksOperation } from "./lib/operations";
import { ZSurveyPersonalLinksBody, ZSurveyPersonalLinksParams } from "./schemas";

/**
 * `POST /api/internal/surveys/{surveyId}/personal-links`: a personal link to the survey for each contact in
 * a segment, as a CSV file. Licence-gated (Contacts).
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSurveyPersonalLinksParams, body: ZSurveyPersonalLinksBody },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    generatePersonalLinksOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      body: parsedInput.body,
      requestId,
      instance,
    }),
});
