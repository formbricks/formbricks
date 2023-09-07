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
export const getResponse = async (responseId: string) => {
  try {
    const response = await fetch(`/api/v1/people`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    console.log(response)
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error; // Rethrow the error to the caller
  }
};
