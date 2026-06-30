"use client";

import { InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TSurveyStatus } from "@formbricks/types/surveys/types";
import { surveyKeys, updateSurveyInInfiniteData } from "@/modules/survey/list/lib/query";
import { TSurveyListPage, updateSurveyStatus } from "@/modules/survey/list/lib/v3-surveys-client";

export const useUpdateSurveyStatus = ({ queryKey }: { queryKey: ReturnType<typeof surveyKeys.list> }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ surveyId, status }: { surveyId: string; status: TSurveyStatus }) =>
      updateSurveyStatus(surveyId, status),
    onMutate: async ({ surveyId, status }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<InfiniteData<TSurveyListPage>>(queryKey);

      queryClient.setQueryData<InfiniteData<TSurveyListPage> | undefined>(queryKey, (currentData) =>
        updateSurveyInInfiniteData(currentData, surveyId, { status })
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
