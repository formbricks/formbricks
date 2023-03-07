import useSWR from "swr";
import { fetcher } from "./fetcher";

export const useEventClasses = (environmentId) => {
  const { data, isLoading, error, mutate, isValidating } = useSWR(
    `/api/v1/environments/${environmentId}/eventClasses`,
    fetcher
  );

  return {
    memberships: data,
    isLoadingMemberships: isLoading,
    isErrorMemberships: error,
    isValidatingMemberships: isValidating,
    mutateMemberships: mutate,
  };
};
