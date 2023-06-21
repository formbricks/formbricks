import { TTag } from "@formbricks/types/v1/tags";
import useSWRMutation from "swr/mutation";

export const useCreateTag = (environmentId: string, productId: string) => {
  const { trigger: createTag, isMutating: isCreatingTag } = useSWRMutation(
    `/api/v1/environments/${environmentId}/product/${productId}/tags`,
    async (url, { arg }: { arg: { name: string } }): Promise<TTag> => {
      return fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: arg.name }),
      }).then((res) => res.json());
    }
  );

  return {
    createTag,
    isCreatingTag,
  };
};

export const useAddTagToResponse = (environmentId: string, surveyId: string, responseId: string) => {
  const response = useSWRMutation(
    `/api/v1/environments/${environmentId}/surveys/${surveyId}/responses/${responseId}/tags`,

    async (url, { arg }: { arg: { tagIdToAdd: string } }): Promise<{ success: boolean; message: string }> => {
      return fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tagId: arg.tagIdToAdd }),
      }).then((res) => res.json());
    }
  );

  return response;
};

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

export const useDeleteTag = (environmentId: string, productId: string, tagId: string) => {
  const { trigger: deleteTag, isMutating: isDeletingTag } = useSWRMutation(
    `/api/v1/environments/${environmentId}/product/${productId}/tags/${tagId}`,
    async (url): Promise<TTag> => {
      return fetch(url, {
        method: "DELETE",
      }).then((res) => res.json());
    }
  );

  return {
    deleteTag,
    isDeletingTag,
  };
};

export const useUpdateTag = (environmentId: string, productId: string, tagId: string) => {
  const { trigger: updateTag, isMutating: isUpdatingTag,
    data: updateTagData, error: updateTagError } = useSWRMutation(
    `/api/v1/environments/${environmentId}/product/${productId}/tags/${tagId}`,

    async (url, { arg }: { arg: { name: string } }): Promise<TTag> => {
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: arg.name }),
      })

      if(!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message)
      }

      return res.json();
    }
  );

  return {
    updateTag,
    isUpdatingTag,
    updateTagData,
    updateTagError
  };
};

export const useMergeTags = (environmentId: string, productId: string) => {
  const { trigger: mergeTags, isMutating: isMergingTags } = useSWRMutation(
    `/api/v1/environments/${environmentId}/product/${productId}/tags/merge`,
    async (url, { arg }: { arg: { originalTagId: string; newTagId: string }}): Promise<{status: boolean; message: string}> => {
      return fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ originalTagId: arg.originalTagId, newTagId: arg.newTagId }),
      }).then((res) => res.json());
    }
  );

  return {
    mergeTags,
    isMergingTags,
  };
}