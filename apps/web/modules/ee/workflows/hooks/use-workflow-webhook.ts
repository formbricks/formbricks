"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TWorkflowWebhookResource } from "@formbricks/workflows";
import {
  getWorkflowWebhook,
  listWorkflowSamples,
  regenerateWorkflowWebhook,
  setWorkflowSample,
} from "../lib/api-client";
import { workflowKeys } from "../lib/query";

/**
 * A Webhook workflow's Secret URL, last call and Sample payload. The Variable picker (ENG-7113) reads
 * the sample's Variables from it and the trigger panel (ENG-7182) shows the rest. Enable it only for
 * members with write access and a saved Webhook trigger: the route refuses everyone else.
 */
export const useWorkflowWebhook = ({
  workflowId,
  enabled,
}: {
  workflowId: string | null;
  enabled: boolean;
}) =>
  useQuery({
    queryKey: workflowKeys.webhook(workflowId ?? ""),
    enabled: enabled && workflowId !== null,
    queryFn: ({ signal }) => getWorkflowWebhook(workflowId as string, signal),
  });

/** Regenerate the Secret URL and replace the Sample payload, keeping the cached webhook in step. */
export const useWorkflowWebhookMutations = (workflowId: string) => {
  const queryClient = useQueryClient();
  const queryKey = workflowKeys.webhook(workflowId);

  const regenerate = useMutation({
    mutationFn: () => regenerateWorkflowWebhook(workflowId),
    onSuccess: (resource) => queryClient.setQueryData<TWorkflowWebhookResource>(queryKey, resource),
  });

  const setSample = useMutation({
    mutationFn: (payload: Record<string, unknown>) => setWorkflowSample(workflowId, payload),
    onSuccess: (sample) =>
      queryClient.setQueryData<TWorkflowWebhookResource>(queryKey, (current) =>
        current ? { ...current, sample } : current
      ),
  });

  return { regenerate, setSample };
};

/**
 * Every sample of the workflow, for the HTTP request steps' response Variables. Write access only,
 * like the Secret URL; a Send test request refreshes it.
 */
export const useWorkflowSamples = ({
  workflowId,
  enabled,
}: {
  workflowId: string | null;
  enabled: boolean;
}) =>
  useQuery({
    queryKey: workflowKeys.samples(workflowId ?? ""),
    enabled: enabled && workflowId !== null,
    queryFn: ({ signal }) => listWorkflowSamples(workflowId as string, signal),
  });
