import useSWRMutation from "swr/mutation";
import { updateRessource } from "../fetcher";

export function useProductMutation(environmentId: string) {
  const { trigger, isMutating } = useSWRMutation(
    `/api/v1/environments/${environmentId}/product`,
    updateRessource
  );

  return {
    triggerProductMutate: trigger,
    isMutatingProduct: isMutating,
  };
}
