import useSWR from "swr";
import { fetcher } from "./fetcher";

export const useEventClasses = (environmentId) => {
  const { data, isLoading, error, mutate, isValidating } = useSWR(
    `/api/v1/environments/${environmentId}/event-classes`,
    fetcher
  );

  return {
    eventClasses: data,
    isLoadingEventClasses: isLoading,
    isErrorEventClasses: error,
    isValidatingEventClasses: isValidating,
    mutateEventClasses: mutate,
  };
};
