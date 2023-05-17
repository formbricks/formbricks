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
    mutateResponses: mutate,
  };
};

export const deleteSubmission = async (environmentId: string, surveyId: string, responseId: string) => {
  const response = await fetch(`/api/v1/environments/${environmentId}/surveys/${surveyId}/responses/${responseId}`, {
    method: "DELETE",
  });

  return response.json();
};
