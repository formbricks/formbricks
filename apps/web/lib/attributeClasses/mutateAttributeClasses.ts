import useSWRMutation from "swr/mutation";
import { updateRessource } from "@formbricks/lib/fetcher";

export function useAttributeClassMutation(environmentId: string, attributeClassId: string) {
  const { trigger, isMutating } = useSWRMutation(
    `/api/v1/environments/${environmentId}/attribute-classes/${attributeClassId}`,
    updateRessource
  );

  return {
    triggerAttributeClassMutate: trigger,
    isMutatingAttributeClass: isMutating,
  };
}
