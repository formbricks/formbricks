import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";

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

export const deletePerson = async (environmentId: string, personId: string) => {
  try {
    await fetch(`/api/v1/environments/${environmentId}/people/${personId}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error(error);
    throw Error(`deletePerson: unable to delete person: ${error.message}`);
  }
};

export const useGetOrCreatePerson = (environmentId: string, personId?: string | null) => {
  const { data, isLoading } = useSWR(
    personId ? `/api/v1/client/people/getOrCreate?userId=${personId}&environmentId=${environmentId}` : null,
    fetcher
  );

  return {
    person: data,
    isLoadingPerson: isLoading,
  };
};
