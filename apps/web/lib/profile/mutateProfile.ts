import useSWRMutation from "swr/mutation";
import { updateRessource } from "@formbricks/lib/fetcher";

export function useProfileMutation() {
  const { trigger, isMutating } = useSWRMutation("/api/v1/users/me/", updateRessource);

  return {
    triggerProfileMutate: trigger,
    isMutatingProfile: isMutating,
  };
}
