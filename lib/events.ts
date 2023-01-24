import useSWR from "swr";
import { fetcher } from "./utils";

export const getEventName = (eventType: string) => {
  switch (eventType) {
    case "pageSubmission":
      return "Page Submission";
    default:
      return eventType;
  }
};

export const useSessionEventUsers = (formId: string) => {
  const { data, error } = useSWR(
    () => `/api/forms/${formId}/events/opened`,
    fetcher
  );

  return {
    candidates: data,
    isLoadingEvents: !error && !data,
    isErrorEvents: error,
  };
};
