"use client";

import { InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";
import { removeSurveyFromInfiniteData, surveyKeys } from "@/modules/survey/list/lib/query";
import { TSurveyListPage, archiveSurvey } from "@/modules/survey/list/lib/v3-surveys-client";

// Archiving removes the survey from the current view: the default list excludes archived surveys,
// and the "Archived" view excludes active ones. onSettled re-fetches so mixed-filter views correct.
export const useArchiveSurvey = ({ queryKey }: { queryKey: ReturnType<typeof surveyKeys.list> }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ surveyId }: { surveyId: string }) => archiveSurvey(surveyId),
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
