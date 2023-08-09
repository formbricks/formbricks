import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";

export const useTeam = (environmentId: string) => {
  const { data, isLoading, error, mutate, isValidating } = useSWR(
    `/api/v1/environments/${environmentId}/team/`,
    fetcher
  );

  return {
    team: data,
    isLoadingTeam: isLoading,
    isErrorTeam: error,
    isValidatingTeam: isValidating,
    mutateTeam: mutate,
  };
};

export const deleteTeam = async (environmentId: string) => {
  const response = await fetch(`/api/v1/environments/${environmentId}/team/`, {
    method: "DELETE",
  });
  return response.json();
};
