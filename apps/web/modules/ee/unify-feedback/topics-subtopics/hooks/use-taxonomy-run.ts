"use client";

import { useQuery } from "@tanstack/react-query";
import { InvalidInputError } from "@formbricks/types/errors";
import { getTaxonomyRun } from "../lib/api-client";
import { taxonomyKeys } from "../lib/query";

const RUN_POLL_INTERVAL_MS = 5000;

/** Poll a taxonomy run until it reaches a terminal state (succeeded/failed/canceled). Keeps polling
 * while the status is unknown too — e.g. a poll that errored before any success — so a transient Hub
 * blip self-recovers instead of leaving the caller stuck showing "generating" forever. */
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
        throw new InvalidInputError("runId is required");
      }
      return getTaxonomyRun({ workspaceId, directoryId, runId, signal });
    },
    staleTime: 0,
    refetchInterval: (query) => {
      // Stop only once the run has genuinely finished. Any other state — pending/running, or unknown
      // because the last poll errored (data undefined) — keeps the interval alive so polling resumes
      // on its own when the Hub recovers.
      const status = query.state.data?.status;
      const isTerminal = status === "succeeded" || status === "failed" || status === "canceled";
      return isTerminal ? false : RUN_POLL_INTERVAL_MS;
    },
  });
