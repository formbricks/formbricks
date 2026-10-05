"use client";

import { InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import { surveyKeys, updateSurveyInInfiniteData } from "@/modules/survey/list/lib/query";
import { TSurveyListPage, updateSurveyVisibility } from "@/modules/survey/list/lib/v3-surveys-client";

/**
 * Change a survey's visibility. With a `listQueryKey` (the survey list) the row is patched
 * optimistically and rolled back on any error — a pending grant (503) included, since the survey stays
 * restricted until it is projected. The editor passes none and reads the result instead.
 */
export const useUpdateSurveyVisibility = ({
  listQueryKey,
}: { listQueryKey?: ReturnType<typeof surveyKeys.list> } = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ surveyId, visibility }: { surveyId: string; visibility: TSurveyVisibility }) =>
      updateSurveyVisibility(surveyId, visibility),
    onMutate: async ({ surveyId, visibility }) => {
      if (!listQueryKey) return { previousData: undefined };

      await queryClient.cancelQueries({ queryKey: listQueryKey });
      const previousData = queryClient.getQueryData<InfiniteData<TSurveyListPage>>(listQueryKey);
      queryClient.setQueryData<InfiniteData<TSurveyListPage> | undefined>(listQueryKey, (currentData) =>
        updateSurveyInInfiniteData(currentData, surveyId, { visibility })
      );

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (listQueryKey && context?.previousData) {
        queryClient.setQueryData(listQueryKey, context.previousData);
      }
    },
    onSettled: async (_data, _error, { surveyId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: surveyKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: surveyKeys.visibility(surveyId) }),
      ]);
    },
  });
};
