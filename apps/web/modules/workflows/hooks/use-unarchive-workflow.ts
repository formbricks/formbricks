"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unarchiveWorkflow } from "../lib/api-client";
import { workflowKeys } from "../lib/query";

/**
 * Restore an archived workflow. Unlike archive/delete, this does not optimistically remove the row:
 * the workflow stays in the list with a new (non-archived) status, and whether it remains visible
 * depends on the active filters — so the list query is invalidated and refetched for the truth.
 */
export const useUnarchiveWorkflow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workflowId }: { workflowId: string }) => unarchiveWorkflow(workflowId),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
    },
  });
};
