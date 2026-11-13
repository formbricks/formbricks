"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TSendWorkflowTestRequestInput } from "@formbricks/workflows";
import { replaceWorkflowSecretHeader, sendWorkflowTestRequest } from "../lib/api-client";
import { workflowKeys } from "../lib/query";

/**
 * "Send test request" (ENG-7179): the one real call an author can make from the editor. An answer is
 * saved as the step's sample, so the samples (and the response Variables later steps pick) refresh.
 */
export const useSendTestRequest = ({ workflowId, stepId }: { workflowId: string; stepId: string }) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TSendWorkflowTestRequestInput) => sendWorkflowTestRequest(workflowId, stepId, input),
    onSuccess: async (result) => {
      if (result.response) {
        await queryClient.invalidateQueries({ queryKey: workflowKeys.samples(workflowId) });
      }
    },
  });
};

/**
 * Replace on an enabled workflow (ADR 0043): saves one secret header value in place; the enabled
 * workflow uses it from its next run. Nothing in the definition changes, so nothing to refetch.
 */
export const useReplaceSecretHeader = ({ workflowId, stepId }: { workflowId: string; stepId: string }) =>
  useMutation({
    mutationFn: ({ headerName, value }: { headerName: string; value: string }) =>
      replaceWorkflowSecretHeader(workflowId, stepId, headerName, value),
  });
