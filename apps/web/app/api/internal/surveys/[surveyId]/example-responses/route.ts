import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { generateExampleResponsesOperation } from "./lib/operations";
import { ZSurveyExampleResponsesParams } from "./schemas";

/**
 * `POST /api/internal/surveys/{surveyId}/example-responses`: write AI-generated example responses into a
 * survey that has none. Audited as an update of the survey. Can run for minutes: the client sets no timeout.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSurveyExampleResponsesParams },
  action: "updated",
  targetType: "survey",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    generateExampleResponsesOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      requestId,
      instance,
      auditLog,
    }),
});
