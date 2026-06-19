"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TCreateWorkflowInput, TWorkflowResource } from "@formbricks/workflows";
import { createWorkflow } from "../lib/api-client";
import { workflowKeys } from "../lib/query";

/**
 * Create a draft workflow via `useMutation` (mirrors the surveys mutation pattern). On success the
 * caller routes to the editor; we invalidate every workflows list query so the new draft shows up
 * on next view without hand-merging it into each cached page/sort/filter permutation.
 */
export const useCreateWorkflow = () => {
  const queryClient = useQueryClient();

  return useMutation<TWorkflowResource, Error, TCreateWorkflowInput>({
    mutationFn: (input: TCreateWorkflowInput) => createWorkflow(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
    },
  });
};
