import useSWR from "swr";
import { fetcher } from "./utils";

export const useSubmissionSessions = (formId: string) => {
  const { data, error, mutate } = useSWR(
    () => `/api/forms/${formId}/submissionSessions`,
    fetcher
  );

  return {
    submissionSessions: data,
    isLoadingSubmissionSessions: !error && !data,
    isErrorSubmissionSessions: error,
    mutateSubmissionSessions: mutate,
  };
};
