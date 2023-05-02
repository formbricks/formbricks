import useSWRMutation from "swr/mutation";
import { updateRessource } from "@formbricks/lib/fetcher";

export function useTeamMutation(teamId: string) {
  const { trigger, isMutating } = useSWRMutation(`/api/v1/teams/${teamId}`, updateRessource);

  return {
    triggerTeamMutate: trigger,
    isMutatingTeam: isMutating,
  };
}
