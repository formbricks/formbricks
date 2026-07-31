"use client";

import { useQuery } from "@tanstack/react-query";
import { InvalidInputError } from "@formbricks/types/errors";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { getTaxonomyRun } from "../lib/api-client";
import { taxonomyKeys } from "../lib/query";

const RUN_POLL_INTERVAL_MS = 5000;

/** Poll a taxonomy run until it reaches a terminal state (succeeded/failed/canceled). Keeps polling while
 * the status is unknown too — e.g. a poll that errored before any success — so a transient Hub blip
 * self-recovers instead of leaving the caller stuck showing "generating" forever.
 *
 * A 404 is the exception, and the reason this stops rather than self-recovering: the run is gone — reaped,
 * or a stale id after a regenerate — so no amount of polling brings it back, and "keep trying" means
 * "generating…" forever at one request every five seconds. */
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
      // A run that no longer exists is terminal however many times we ask. The endpoint returns 404 for
      // both "no such run" and "not this directory's run", so the status alone is enough to decide.
      const { error } = query.state;
      if (error instanceof V3ApiError && error.status === 404) {
        return false;
      }

      // Otherwise stop only once the run has genuinely finished. Any other state — pending/running, or
      // unknown because the last poll errored (data undefined) — keeps the interval alive so polling
      // resumes on its own when the Hub recovers.
      const status = query.state.data?.status;
      const isTerminal = status === "succeeded" || status === "failed" || status === "canceled";
      return isTerminal ? false : RUN_POLL_INTERVAL_MS;
    },
  });
