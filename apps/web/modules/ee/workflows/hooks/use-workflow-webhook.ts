"use client";

import { useQuery } from "@tanstack/react-query";
import { getWorkflowWebhook } from "../lib/api-client";
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
