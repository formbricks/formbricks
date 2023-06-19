import { fetcher } from "@formbricks/lib/fetcher";
import useSWR from "swr";
import { TTag } from "@formbricks/types/v1/tags";

export const useTags = (environmentId: string, surveyId: string, responseId: string) => {
  const responseTags = useSWR<TTag>(
    `/api/v1/environments/${environmentId}/surveys/${surveyId}/responses/${responseId}/tags`,
    fetcher
  );

  return responseTags;
};

export const useTagsForProduct = (environmentId: string, productId: string) => {
  const tagsForProducts = useSWR<TTag[]>(
    `/api/v1/environments/${environmentId}/product/${productId}/tags`,
    fetcher
  );

  return tagsForProducts;
};
