import useSWRMutation from "swr/mutation";
import { updateRessource } from "@formbricks/lib/fetcher";

export function useEnvironmentMutation(environmentId: string) {
  const { trigger, isMutating } = useSWRMutation(`/api/v1/environments/${environmentId}`, updateRessource);

  return {
    triggerEnvironmentMutate: trigger,
    isMutatingEnvironment: isMutating,
  };
}
