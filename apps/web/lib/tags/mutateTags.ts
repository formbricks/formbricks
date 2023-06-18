import useSWRMutation from "swr/mutation";

export const useCreateTag = (environmentId: string, surveyId: string, responseId: string) => {
  const { trigger: createTag, isMutating: isCreatingTag } = useSWRMutation(
    `/api/v1/environments/${environmentId}/surveys/${surveyId}/responses/${responseId}/tags`,
    (url, { arg }: { arg: { productId: string; name: string } }) => {
      return fetch(url, {
        method: "POST",
        body: JSON.stringify({ name: arg.name, productId: arg.productId }),
      });
    }
  );

  return {
    createTag,
    isCreatingTag,
  };
};
