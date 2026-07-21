"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TCreateWorkflowInput, TWorkflowResource } from "@formbricks/workflows";
import { createWorkflow } from "../lib/api-client";
import { workflowKeys } from "../lib/query";

export const useCreateWorkflow = () => {
  const queryClient = useQueryClient();

  return useMutation<TWorkflowResource, Error, TCreateWorkflowInput>({
    mutationFn: (input: TCreateWorkflowInput) => createWorkflow(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
    },
  });
};
