import { fetcher } from "@formbricks/lib/fetcher";
import useSWR from "swr";

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
  const response = await fetch(
    `/api/v1/environments/${environmentId}/surveys/${surveyId}/responses/${responseId}`,
    {
      method: "DELETE",
    }
  );

  return response.json();
};

export const addTagToResponse = async (
  environmentId: string,
  surveyId: string,
  responseId: string,
  tagIdToAdd: string
) => {
  const response = await fetch(
    `/api/v1/environments/${environmentId}/surveys/${surveyId}/responses/${responseId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ tagIdToAdd }),
    }
  );

  return response.json();
};

export const deleteTagFromResponse = async (
  environmentId: string,
  surveyId: string,
  responseId: string,
  tagId: string
) => {
  const response = await fetch(
    `/api/v1/environments/${environmentId}/surveys/${surveyId}/responses/${responseId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ tagIdToDelete: tagId }),
    }
  );

  return response.json();
};
