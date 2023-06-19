import { fetcher } from "@formbricks/lib/fetcher";
import useSWRMutation from "swr/mutation";
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

export const useAddTagToResponse = (environmentId: string, surveyId: string, responseId: string) => {
  const response = useSWRMutation(
    `/api/v1/environments/${environmentId}/surveys/${surveyId}/responses/${responseId}/tags`,

    async (url, { arg }: { arg: { tagIdToAdd: string } }) => {
      return fetch(url, {
        method: "POST",
        body: JSON.stringify({ tagId: arg.tagIdToAdd }),
      }).then((res) => res.json());
    }
  );

  return response;
};

// export const useRemoveTagFromResponse = (environmentId: string, surveyId: string, responseId: string) => {
//   const response = useSWRMutation(
//     `/api/v1/environments/${environmentId}/surveys/${surveyId}/responses/${responseId}/tags`,

//     async (url, { arg }: { arg: { tagIdToRemove: string } }) => {
//       return await fetch(url, {
//         method: "DELETE",
//         body: JSON.stringify({ tagId: arg.tagIdToRemove }),
//       }).then((res) => res.json());
//     }
//   );

//   return response;
// };

export const removeTagFromResponse = async (
  environmentId: string,
  surveyId: string,
  responseId: string,
  tagId: string
) => {
  const response = await fetch(
    `/api/v1/environments/${environmentId}/surveys/${surveyId}/responses/${responseId}/tags/${tagId}`,
    {
      method: "DELETE",
    }
  );

  return response.json();
};
