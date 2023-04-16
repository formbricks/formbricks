import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";

export const useResponses = (environmentId: string, surveyId: string) => {
  const { data, error, mutate, isLoading } = useSWR(
    `/api/v1/environments/${environmentId}/surveys/${surveyId}/responses`,
    fetcher
  );

  return {
    responsesData: data,
    isLoadingResponses: isLoading,
    isErrorResponses: error,
    mutateRespones: mutate,
  };
};
