import useSWR from "swr";
import { fetcher } from "./fetcher";

export const usePeople = (environmentId) => {
  const { data, isLoading, error, mutate, isValidating } = useSWR(
    `/api/v1/environments/${environmentId}/people`,
    fetcher
  );

  return {
    people: data,
    isLoadingPeople: isLoading,
    isErrorPeople: error,
    isValidatingPeople: isValidating,
    mutatePeople: mutate,
  };
};
