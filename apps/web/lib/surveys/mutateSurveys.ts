import useSWRMutation from "swr/mutation";
import { updateRessource } from "@formbricks/lib/fetcher";

export function useSurveyMutation(environmentId: string, surveyId: string) {
  const { trigger, isMutating } = useSWRMutation(
    `/api/v1/environments/${environmentId}/surveys/${surveyId}`,
    updateRessource
  );

  return {
    triggerSurveyMutate: trigger,
    isMutatingSurvey: isMutating,
  };
}
