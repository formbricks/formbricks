"use client";

import { InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";
import { surveyKeys, updateSurveyInInfiniteData } from "@/modules/survey/list/lib/query";
import { TSurveyListPage, renameSurvey } from "@/modules/survey/list/lib/v3-surveys-client";

export const useRenameSurvey = ({ queryKey }: { queryKey: ReturnType<typeof surveyKeys.list> }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ surveyId, name }: { surveyId: string; name: string }) =>
      renameSurvey(surveyId, name),
    onMutate: async ({ surveyId, name }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<InfiniteData<TSurveyListPage>>(queryKey);

      queryClient.setQueryData<InfiniteData<TSurveyListPage> | undefined>(queryKey, (currentData) =>
        updateSurveyInInfiniteData(currentData, surveyId, { name })
      );

      return { previousData };
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
