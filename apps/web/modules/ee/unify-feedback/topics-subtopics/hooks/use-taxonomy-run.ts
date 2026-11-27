"use client";

import { useQuery } from "@tanstack/react-query";
import { InvalidInputError } from "@formbricks/types/errors";
import { V3ApiError, isAuthFailure } from "@/modules/api/lib/v3-client";
import { getTaxonomyRun } from "../lib/api-client";
import { taxonomyKeys } from "../lib/query";

const RUN_POLL_INTERVAL_MS = 5000;

/**
 * The run no longer exists — reaped by the orphan cleaner, or a stale id after a regenerate. The endpoint
 * answers 404 for both "no such run" and "not this directory's run", so the status alone decides.
 *
 * Shared rather than inlined because two things have to agree about it: this hook stops polling, and the
 * container stops treating the run as in-flight. If they disagreed, the UI would sit on "generating…" with
 * the Generate button disabled and nothing left to poll — stuck until a page reload.
 */
export const isTaxonomyRunGone = (error: unknown): boolean =>
  error instanceof V3ApiError && error.status === 404;

/** Poll a taxonomy run until it reaches a terminal state (succeeded/failed/canceled). Keeps polling while
 * the status is unknown too — e.g. a poll that errored before any success — so a transient Hub blip
 * self-recovers instead of leaving the caller stuck showing "generating" forever.
 *
 * A 404 is the exception, and the reason this stops rather than self-recovering: the run is gone — reaped,
 * or a stale id after a regenerate — so no amount of polling brings it back, and "keep trying" means
 * "generating…" forever at one request every five seconds. A 401 or 403 stops it too (`isAuthFailure`):
 * the caller, not the Hub, is the problem, and a refocus or remount picks the poll back up once it clears. */
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
      // A run that no longer exists is terminal however many times we ask, and so is a caller whose
      // session or access is gone until something else refetches.
      if (isTaxonomyRunGone(query.state.error) || isAuthFailure(query.state.error)) {
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
