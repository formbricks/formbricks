"use client";

import { useQuery } from "@tanstack/react-query";
import { getTaxonomyRun } from "../lib/api-client";
import { taxonomyKeys } from "../lib/query";

const RUN_POLL_INTERVAL_MS = 5000;

/** Poll a taxonomy run while it is pending/running; stops at a terminal state. */
export const useTaxonomyRun = ({
  workspaceId,
  directoryId,
  runId,
  enabled = true,
}: Readonly<{ workspaceId: string; directoryId: string; runId: string | null; enabled?: boolean }>) =>
  useQuery({
    queryKey: taxonomyKeys.run(workspaceId, directoryId, runId ?? ""),
    enabled: enabled && runId !== null,
    queryFn: ({ signal }) => {
      if (!runId) {
        throw new Error("runId is required");
      }
      return getTaxonomyRun({ workspaceId, directoryId, runId, signal });
    },
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "running" ? RUN_POLL_INTERVAL_MS : false;
    },
  });
