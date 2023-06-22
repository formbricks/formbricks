import { fetcher } from "@formbricks/lib/fetcher";
import useSWR from "swr";
import { TTag, TTagsCount } from "@formbricks/types/v1/tags";
import { useMemo } from "react";

export const useTagsForEnvironment = (environmentId: string) => {
  const tagsForProducts = useSWR<TTag[]>(`/api/v1/environments/${environmentId}/tags`, fetcher);

  return tagsForProducts;
};

export const useTagsCountForEnvironment = (environmentId: string) => {
  const {
    data: tagsCount,
    isLoading: isLoadingTagsCount,
    mutate: mutateTagsCount,
  } = useSWR<TTagsCount>(`/api/v1/environments/${environmentId}/tags/count`, fetcher);

  const transformedTagsCount = useMemo(() => {
    if (!tagsCount) return [];

    return tagsCount.map((tagCount) => ({ tagId: tagCount.tagId, count: tagCount._count._all }));
  }, [tagsCount]);

  return {
    tagsCount: transformedTagsCount,
    isLoadingTagsCount,
    mutateTagsCount,
  };
};
