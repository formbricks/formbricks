"use client";

import { useMutationState } from "@tanstack/react-query";
import { surveyMutationKeys } from "@/modules/survey/list/lib/query";

function getRemovedSurveyId(variables: unknown): string | undefined {
  if (typeof variables !== "object" || variables === null) {
    return undefined;
  }

  const { surveyId } = variables as { surveyId?: unknown };

  return typeof surveyId === "string" ? surveyId : undefined;
}

/**
 * Survey ids whose removal (archive, restore or delete) is still in flight.
 *
 * The optimistic cache patch in `useSurveyRemovalMutation` cannot keep such a survey out of the list
 * on its own: `cancelQueries` only covers fetches already running when the mutation starts, so any
 * list fetch that begins after the patch — a remount, a window-focus refetch, a pagination page, or
 * a filter change swapping in another cache entry — resolves with server data that still contains
 * the survey, and the row flashes back while the operation runs (ENG-2583).
 *
 * Reading the pending removals at render time closes that window regardless of which refetch wrote
 * the cache. The mutation stays pending until its `onSettled` invalidation has landed, so the
 * suppression is released only once the cache holds server truth — on success the survey is gone,
 * and on failure the rollback puts it back exactly once.
 */
export const usePendingSurveyRemovals = (): string[] => {
  const pendingRemovals = useMutationState({
    filters: { mutationKey: surveyMutationKeys.removal(), status: "pending" },
    select: (mutation) => getRemovedSurveyId(mutation.state.variables),
  });

  return pendingRemovals.filter((surveyId): surveyId is string => surveyId !== undefined);
};
