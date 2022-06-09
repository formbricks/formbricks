import useSWR from "swr";
import { fetcher } from "./utils";

export const useAnswerSessions = (formId: string) => {
  const { data, error, mutate } = useSWR(
    () => `/api/forms/${formId}/submissionSessions`,
    fetcher
  );

  return {
    submissionSessions: data,
    isLoadingAnswerSessions: !error && !data,
    isErrorAnswerSessions: error,
    mutateAnswerSessions: mutate,
  };
};
