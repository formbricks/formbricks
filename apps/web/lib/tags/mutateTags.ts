import useSWRMutation from "swr/mutation";

export const useCreateTag = (environmentId: string, productId: string) => {
  const { trigger: createTag, isMutating: isCreatingTag } = useSWRMutation(
    `/api/v1/environments/${environmentId}/product/${productId}/tags`,
    (url, { arg }: { arg: { responseId: string; name: string } }) => {
      return fetch(url, {
        method: "POST",
        body: JSON.stringify({ name: arg.name, responseId: arg.responseId }),
      });
    }
  );

  return {
    createTag,
    isCreatingTag,
  };
};
