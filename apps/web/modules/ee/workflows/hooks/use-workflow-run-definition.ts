"use client";

import { useQuery } from "@tanstack/react-query";
import { getWorkflowRunDefinition } from "../lib/api-client";
import { workflowRunKeys } from "../lib/query";

export type { TWorkflowRunDefinition } from "../lib/api-client";

/**
 * The graph a run executed, for drawing the run on a read-only canvas: its version's for a live run,
 * the draft a Test run saved, or `{ source: "unknown", definition: null }`. A run's graph never changes,
 * so it is fetched once and kept (`staleTime: Infinity`).
 */
export const useWorkflowRunDefinition = ({
  workflowId,
  runId,
  enabled = true,
}: {
  workflowId: string | null;
  runId: string | null;
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: workflowRunKeys.definition(workflowId ?? "", runId ?? ""),
    enabled: enabled && workflowId !== null && runId !== null,
    staleTime: Infinity,
    queryFn: ({ signal }) => getWorkflowRunDefinition(workflowId as string, runId as string, signal),
  });
