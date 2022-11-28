import useSWR from "swr";
import { fetcher } from "./utils";

export const useMemberships = () => {
  const { data, error, mutate } = useSWR(`/api/memberships`, fetcher);

  return {
    memberships: data,
    isLoadingMemberships: !error && !data,
    isErrorMemberships: error,
    mutateMemberships: mutate,
  };
};
