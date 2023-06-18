import useSWRMutation from "swr/mutation";

export const useCreateTag = (
  environmentId: string,
  surveyId: string,
  responseId: string,
  tagName: string
) => {
  const { trigger: createTag, isMutating: isCreatingTag } = useSWRMutation(
    `/api/v1/environments/${environmentId}/surveys/${surveyId}/responses/${responseId}/tags`,
    () => {
      return fetch(`/api/v1/environments/${environmentId}/surveys/${surveyId}/responses/${responseId}/tags`, {
        method: "POST",
        body: JSON.stringify({ name: tagName }),
      });
    }
  );

  return {
    createTag,
    isCreatingTag,
  };
};
