import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";

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

export const useEventClass = (environmentId, eventClassId) => {
  const { data, isLoading, error, mutate, isValidating } = useSWR(
    `/api/v1/environments/${environmentId}/event-classes/${eventClassId}`,
    fetcher
  );

  return {
    eventClass: data,
    isLoadingEventClass: isLoading,
    isErrorEventClass: error,
    isValidatingEventClass: isValidating,
    mutateEventClass: mutate,
  };
};

export const createEventClass = async (environmentId, eventClass) => {
  const response = await fetch(`/api/v1/environments/${environmentId}/event-classes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventClass),
  });

  return response.json();
};
