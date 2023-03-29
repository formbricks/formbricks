import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";

export const useEvents = (environmentId) => {
  const { data, isLoading, error, mutate, isValidating } = useSWR(
    `/api/v1/environments/${environmentId}/events`,
    fetcher
  );

  return {
    events: data,
    isLoadingEvents: isLoading,
    isErrorEvents: error,
    isValidatingEvents: isValidating,
    mutateEvents: mutate,
  };
};
