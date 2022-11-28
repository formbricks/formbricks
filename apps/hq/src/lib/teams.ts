import useSWR from "swr";
import { fetcher } from "./utils";

export const useTeam = (id: string) => {
  const { data, error, mutate } = useSWR(`/api/teams/${id}/`, fetcher);

  return {
    team: data,
    isLoadingTeam: !error && !data,
    isErrorTeam: error,
    mutateTeam: mutate,
  };
};
