"use client";

import { InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";
import { removeSurveyFromInfiniteData, surveyKeys } from "@/modules/survey/list/lib/query";
import { TSurveyListPage, restoreSurvey } from "@/modules/survey/list/lib/v3-surveys-client";

// Restoring removes the survey from the "Archived" view (it is no longer archived). onSettled
// re-fetches so the default list picks it back up.
export const useRestoreSurvey = ({ queryKey }: { queryKey: ReturnType<typeof surveyKeys.list> }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ surveyId }: { surveyId: string }) => restoreSurvey(surveyId),
    onMutate: async ({ surveyId }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<InfiniteData<TSurveyListPage>>(queryKey);

      queryClient.setQueryData<InfiniteData<TSurveyListPage> | undefined>(queryKey, (currentData) =>
        removeSurveyFromInfiniteData(currentData, surveyId)
      );

      return {
        previousData,
      };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: surveyKeys.lists() });
    },
  });
};
