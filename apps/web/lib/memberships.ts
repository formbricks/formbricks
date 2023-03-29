import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";

export const useMemberships = () => {
  const { data, isLoading, error, mutate, isValidating } = useSWR(`/api/v1/memberships/`, fetcher);

  return {
    memberships: data,
    isLoadingMemberships: isLoading,
    isErrorMemberships: error,
    isValidatingMemberships: isValidating,
    mutateMemberships: mutate,
  };
};
