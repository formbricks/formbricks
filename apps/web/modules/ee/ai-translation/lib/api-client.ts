import type { TAITranslationBody } from "@/app/api/internal/ai-translations/schemas";
import type {
  TAITranslationAvailabilityResource,
  TAITranslationResource,
} from "@/app/api/internal/ai-translations/serializers";
import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";

const BASE_PATH = "/api/internal/ai-translations";

export const getAITranslationAvailability = (surveyId: string, { signal }: { signal?: AbortSignal } = {}) =>
  getApiData<TAITranslationAvailabilityResource>(buildApiUrl(`${BASE_PATH}/availability`, { surveyId }), {
    signal,
  });

/**
 * Translate a survey's texts. No client timeout: a generation runs as long as the server's own AI
 * timeout allows, which is longer than the default write timeout.
 */
export const translateSurveyFields = (workspaceId: string, body: TAITranslationBody) =>
  sendApiRequest<TAITranslationResource>(buildApiUrl(BASE_PATH, { workspaceId }), {
    method: "POST",
    body,
    timeoutMs: null,
  });
