"use client";

import { InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";
import { removeSurveyFromInfiniteData, surveyKeys } from "@/modules/survey/list/lib/query";
import { TSurveyListPage } from "@/modules/survey/list/lib/v3-surveys-client";

// Shared optimistic-mutation hook for survey actions that remove a survey from the current list view
// (delete, archive, restore). Each optimistically drops the survey from the cached infinite data,
// rolls back on error, and re-fetches on settle so mixed-filter views reconcile. Callers supply only
// the v3 client request for their specific action.
export const useSurveyRemovalMutation = ({
  queryKey,
  mutationFn,
}: {
  queryKey: ReturnType<typeof surveyKeys.list>;
  mutationFn: (surveyId: string) => Promise<unknown>;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ surveyId }: { surveyId: string }) => mutationFn(surveyId),
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
