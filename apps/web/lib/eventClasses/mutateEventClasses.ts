import useSWRMutation from "swr/mutation";
import { updateRessource } from "@formbricks/lib/fetcher";

export function useEventClassMutation(environmentId: string, eventClassId: string) {
  const { trigger, isMutating } = useSWRMutation(
    `/api/v1/environments/${environmentId}/event-classes/${eventClassId}`,
    updateRessource
  );

  return {
    triggerEventClassMutate: trigger,
    isMutatingEventClass: isMutating,
  };
}
