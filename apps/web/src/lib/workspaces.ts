import useSWR from "swr";
import { fetcher } from "./utils";

export const useWorkspace = (id: string) => {
  const { data, error, mutate } = useSWR(`/api/workspaces/${id}/`, fetcher);

  return {
    workspace: data,
    isLoadingWorkspace: !error && !data,
    isErrorWorkspace: error,
    mutateWorkspace: mutate,
  };
};
