import useSWR from "swr";
import { fetcher } from "./utils";

export const useOrganisation = (id: string) => {
  const { data, error, mutate } = useSWR(`/api/organisations/${id}/`, fetcher);

  return {
    organisation: data,
    isLoadingOrganisation: !error && !data,
    isErrorOrganisation: error,
    mutateOrganisation: mutate,
  };
};
