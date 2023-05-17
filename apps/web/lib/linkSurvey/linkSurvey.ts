import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";
import type { SurveyResponse } from "@formbricks/types/api/client";

export const useLinkSurvey = (surveyId: string) => {
  const { data, error, mutate, isLoading } = useSWR(`/api/v1/client/surveys/${surveyId}`, fetcher);

  return {
    survey: data?.data as SurveyResponse,
    isLoadingSurvey: isLoading,
    isErrorSurvey: error,
    mutateSurvey: mutate,
  };
};
