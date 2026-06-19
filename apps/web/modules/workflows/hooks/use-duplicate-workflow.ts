"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TWorkflowResource } from "@formbricks/workflows";
import { duplicateWorkflow } from "../lib/api-client";
import { workflowKeys } from "../lib/query";

/**
 * Duplicate a workflow into a new draft via `useMutation`. The copy's name and position under the
 * current sort are server-decided, so rather than splice it into each cached page we invalidate
 * every workflows list query and let the next read pick it up.
 */
export const useDuplicateWorkflow = () => {
  const queryClient = useQueryClient();

  return useMutation<TWorkflowResource, Error, { workflowId: string }>({
    mutationFn: ({ workflowId }: { workflowId: string }) => duplicateWorkflow(workflowId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
    },
  });
};
