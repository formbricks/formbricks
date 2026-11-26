import { queryOptions } from "@tanstack/react-query";
import { QUERY_RETRY, QUERY_STALE_TIME_MS } from "@/modules/api/lib/query-client";
import { getAITranslationAvailability } from "./api-client";

export const aiTranslationKeys = {
  all: ["ai-translations"] as const,
  availability: (surveyId: string) => [...aiTranslationKeys.all, "availability", surveyId] as const,
};

/**
 * Whether the survey editor may offer AI translation. Carries the app's retry rule and freshness itself,
 * because the survey editor's client retries everything — a 403 included — and refetches on every focus.
 */
export const aiTranslationAvailabilityQueryOptions = (surveyId: string) =>
  queryOptions({
    queryKey: aiTranslationKeys.availability(surveyId),
    queryFn: ({ signal }) => getAITranslationAvailability(surveyId, { signal }),
    staleTime: QUERY_STALE_TIME_MS,
    ...QUERY_RETRY,
  });
