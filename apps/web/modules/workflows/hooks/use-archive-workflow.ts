"use client";

import { type InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";
import { archiveWorkflow } from "../lib/api-client";
import type { TWorkflowListPage } from "../lib/api-client";
import { removeWorkflowFromInfiniteData, workflowKeys } from "../lib/query";

/**
 * Archive (soft-delete) a workflow via `useMutation`, mirroring `use-delete-survey.ts`. The list
 * excludes archived workflows by default, so an archive optimistically drops the row from the
 * loaded pages; on error we roll the cache back, and on settle we invalidate every list query.
 */
export const useArchiveWorkflow = ({ queryKey }: { queryKey: ReturnType<typeof workflowKeys.list> }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workflowId }: { workflowId: string }) => archiveWorkflow(workflowId),
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
