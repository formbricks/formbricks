import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";

export const useAttributeClasses = (environmentId) => {
  const { data, isLoading, error, mutate, isValidating } = useSWR(
    `/api/v1/environments/${environmentId}/attribute-classes`,
    fetcher
  );

  return {
    attributeClasses: data,
    isLoadingAttributeClasses: isLoading,
    isErrorAttributeClasses: error,
    isValidatingAttributeClasses: isValidating,
    mutateAttributeClasses: mutate,
  };
};
