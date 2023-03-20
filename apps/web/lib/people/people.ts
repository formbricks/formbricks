import useSWR from "swr";
import { fetcher } from "../fetcher";

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

export const usePerson = (environmentId, personId) => {
  const { data, isLoading, error, mutate, isValidating } = useSWR(
    `/api/v1/environments/${environmentId}/people/${personId}`,
    fetcher
  );

  return {
    person: data,
    isLoadingPerson: isLoading,
    isErrorPerson: error,
    isValidatingPerson: isValidating,
    mutatePerson: mutate,
  };
};
