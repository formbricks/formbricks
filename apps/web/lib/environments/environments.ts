import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";

export const useEnvironment = (environmentId: string) => {
  const { data, isLoading, error, mutate, isValidating } = useSWR(
    `/api/v1/environments/${environmentId}/`,
    fetcher
  );

  return {
    environment: data,
    isLoadingEnvironment: isLoading,
    isErrorEnvironment: error,
    isValidatingEnvironment: isValidating,
    mutateOrganisation: mutate,
  };
};
