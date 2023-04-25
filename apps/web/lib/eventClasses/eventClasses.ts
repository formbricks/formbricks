import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";
import type { Event } from "@formbricks/types/events";

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

export const createEventClass = async (environmentId, eventClass: Event) => {
  const response = await fetch(`/api/v1/environments/${environmentId}/event-classes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventClass),
  });

  if (!response.ok) {
    if (response.status === 409) {
      throw Error("Action with this name already exists");
    }
    throw Error(`Unable to create Action: ${response.statusText}`);
  }

  return response.json();
};

export const deleteEventClass = async (environmentId: string, eventClassId: string) => {
  try {
    const res = await fetch(`/api/v1/environments/${environmentId}/event-classes/${eventClassId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw Error(`deleteEventClass: unable to delete eventClass: ${res.statusText}`);
    }
  } catch (error) {
    console.error(error);
    throw Error(`deleteEventClass: unable to delete eventClass: ${error.message}`);
  }
};
