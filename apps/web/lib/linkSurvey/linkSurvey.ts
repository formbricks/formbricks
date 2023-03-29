import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";

export const useLinkSurvey = (surveyId: string) => {
  const { data, error, mutate, isLoading } = useSWR(`/api/v1/client/surveys/${surveyId}`, fetcher);

  return {
    survey: data,
    isLoadingSurvey: isLoading,
    isErrorSurvey: error,
    mutateSurvey: mutate,
  };
};
