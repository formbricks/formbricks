"use client";

import { InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TSurveyStatus } from "@formbricks/types/surveys/types";
import { updateSurveyStatusAction } from "@/modules/survey/editor/actions";
import { surveyKeys, updateSurveyInInfiniteData } from "@/modules/survey/list/lib/query";
import type { TSurveyListPage } from "@/modules/survey/list/lib/v3-surveys-client";

type TUpdateSurveyStatusInput = {
  surveyId: string;
  status: Exclude<TSurveyStatus, "draft">;
};

export const useUpdateSurveyStatus = ({ queryKey }: { queryKey: ReturnType<typeof surveyKeys.list> }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ surveyId, status }: TUpdateSurveyStatusInput) =>
      updateSurveyStatusAction({ surveyId, status }),
    onMutate: async ({ surveyId, status }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<InfiniteData<TSurveyListPage>>(queryKey);

      queryClient.setQueryData<InfiniteData<TSurveyListPage> | undefined>(queryKey, (currentData) =>
        updateSurveyInInfiniteData(currentData, {
          id: surveyId,
          status,
          updatedAt: new Date(),
          ...(status === "paused" ? {} : { publishOn: null }),
        })
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
    onSuccess: (response, _variables, context) => {
      if (!response?.data) {
        if (context?.previousData) {
          queryClient.setQueryData(queryKey, context.previousData);
        }

        return;
      }

      const { id, publishOn, status, updatedAt } = response.data;

      queryClient.setQueryData<InfiniteData<TSurveyListPage> | undefined>(queryKey, (currentData) =>
        updateSurveyInInfiniteData(currentData, {
          id,
          publishOn,
          status,
          updatedAt,
        })
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: surveyKeys.lists() });
    },
  });
};
