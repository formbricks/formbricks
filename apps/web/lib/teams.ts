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
