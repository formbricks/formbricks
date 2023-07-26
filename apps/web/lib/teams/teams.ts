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

export const addDemoProduct = async (teamId: string) => {
  let response;

  try {
    response = await fetch(`/api/v1/teams/${teamId}/add_demo_product`, {
      method: "POST",
    });
  } catch (err) {
    console.log(err);
    throw new Error(err);
  }
};
