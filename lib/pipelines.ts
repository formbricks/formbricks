import useSWR from "swr";
import { fetcher } from "./utils";

export const usePipelines = (formId: string) => {
  const { data, error, mutate } = useSWR(
    () => `/api/forms/${formId}/pipelines`,
    fetcher
  );

  return {
    pipelines: data,
    isLoadingPipelines: !error && !data,
    isErrorPipelines: error,
    mutatePipeliness: mutate,
  };
};
