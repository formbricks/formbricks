import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";
import { INTERNAL_SECRET } from "@formbricks/lib/constants";

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
  const response = await fetch(`/api/v1/teams/${teamId}/add_demo_product`, {
    method: "POST",
    headers: {
      "x-api-key": INTERNAL_SECRET,
    },
  });

  if (!response.ok) {
    const error = new Error("An error occurred while adding the demo product to your team.");
    throw error;
  }

  return response.json();
};
