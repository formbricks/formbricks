"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TWorkflowSampleList, TWorkflowWebhookResource } from "@formbricks/workflows";
import {
  getWorkflowWebhook,
  listWorkflowSamples,
  regenerateWorkflowWebhook,
  setWorkflowExpectedResponse,
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
  refetchInterval,
}: {
  workflowId: string | null;
  enabled: boolean;
  /** Poll while waiting for something, e.g. the first call; return false to stop. */
  refetchInterval?: (data: TWorkflowWebhookResource | undefined) => number | false;
}) =>
  useQuery({
    queryKey: workflowKeys.webhook(workflowId ?? ""),
    enabled: enabled && workflowId !== null,
    queryFn: ({ signal }) => getWorkflowWebhook(workflowId as string, signal),
    refetchInterval: refetchInterval ? (query) => refetchInterval(query.state.data) : undefined,
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

/**
 * Saves an HTTP request step's expected response body (ADR 0054) into the samples the editor already holds,
 * so the step's Variables update at once.
 */
export const useSetExpectedResponse = (workflowId: string, stepId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => setWorkflowExpectedResponse(workflowId, stepId, body),
    // Stored as the step's sample, in a Test request response's shape, which is what the samples hold.
    onSuccess: (resource) =>
      queryClient.setQueryData<TWorkflowSampleList>(workflowKeys.samples(workflowId), (current) => [
        ...(current ?? []).filter((item) => item.source !== resource.stepId),
        {
          source: resource.stepId,
          sample: { status: 200, contentType: "application/json", body: resource.body, bodyTruncated: false },
          updatedAt: resource.updatedAt,
        },
      ]),
  });
};
