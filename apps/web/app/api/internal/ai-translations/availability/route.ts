import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getAITranslationAvailabilityOperation } from "../lib/operations";
import { ZAITranslationAvailabilityQuery } from "../schemas";

/** `GET /api/internal/ai-translations/availability?surveyId=`: whether the editor may offer AI translation. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZAITranslationAvailabilityQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getAITranslationAvailabilityOperation({
      authentication,
      surveyId: parsedInput.query.surveyId,
      requestId,
      instance,
    }),
});
