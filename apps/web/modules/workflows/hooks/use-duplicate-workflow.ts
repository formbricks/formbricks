"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TWorkflowResource } from "@formbricks/workflows";
import { duplicateWorkflow } from "../lib/api-client";
import { workflowKeys } from "../lib/query";

export const useDuplicateWorkflow = () => {
  const queryClient = useQueryClient();

  return useMutation<TWorkflowResource, Error, { workflowId: string }>({
    mutationFn: ({ workflowId }: { workflowId: string }) => duplicateWorkflow(workflowId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
    },
  });
};
