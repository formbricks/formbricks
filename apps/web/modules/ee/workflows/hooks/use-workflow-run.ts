"use client";

import { useQuery } from "@tanstack/react-query";
import { getWorkflowRun } from "../lib/api-client";
import { workflowRunKeys } from "../lib/query";

// Single run detail (step logs, trigger payload, run data) fetched on demand — the drawer passes the
// selected run's id and only fetches while open. Static for v1: no refetchInterval, the user reopens
// or refetches to see in-flight runs progress.
export const useWorkflowRun = ({ runId, enabled = true }: { runId: string | null; enabled?: boolean }) => {
  return useQuery({
    queryKey: workflowRunKeys.detail(runId ?? ""),
    enabled: enabled && runId !== null,
    queryFn: ({ signal }) => getWorkflowRun(runId as string, signal),
  });
};
