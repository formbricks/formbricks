"use client";

import { type InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteWorkflow } from "../lib/api-client";
import type { TWorkflowListPage } from "../lib/api-client";
import { removeWorkflowFromInfiniteData, workflowKeys } from "../lib/query";

export const useDeleteWorkflow = ({ queryKey }: { queryKey: ReturnType<typeof workflowKeys.list> }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workflowId }: { workflowId: string }) => deleteWorkflow(workflowId),
    onMutate: async ({ workflowId }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<InfiniteData<TWorkflowListPage>>(queryKey);

      queryClient.setQueryData<InfiniteData<TWorkflowListPage> | undefined>(queryKey, (currentData) =>
        removeWorkflowFromInfiniteData(currentData, workflowId)
      );

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
    },
  });
};
