"use client";

import { useQuery } from "@tanstack/react-query";
import { aiTranslationAvailabilityQueryOptions } from "../lib/query";

/**
 * Whether AI translation is available for a survey, and if not, why. A failed check reads as unavailable
 * with no reason, so the editor never offers a button the server would refuse.
 */
export const useAITranslationAvailability = (surveyId: string) => {
  const { data } = useQuery(aiTranslationAvailabilityQueryOptions(surveyId));
  return {
    isAIAvailable: data?.available ?? false,
    aiUnavailableReason: data && !data.available ? data.reason : undefined,
  };
};
