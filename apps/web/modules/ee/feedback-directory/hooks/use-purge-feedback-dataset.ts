"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { purgeFeedbackDataset } from "@/modules/ee/feedback-directory/lib/api-client";

/**
 * Request a purge of every feedback record in a dataset.
 *
 * There is deliberately no optimistic update and nothing to invalidate: the purge runs in the
 * background on the Hub and this screen lists datasets, not records, so there is no local state that
 * "records are gone" would be true of yet. Success here means *accepted*.
 *
 * The hook — not the caller — owns "one purge at a time". `isPending` cannot carry that guard:
 * React Query notifies its observers through a scheduled task, so the re-render that disables the
 * confirm button lands *after* the second click of a double-click has already run the handler, and
 * two `POST …/purge` requests start two Hub jobs for one user action (ENG-2603). A ref flips
 * synchronously, inside the first click's handler, so the second click never gets past it.
 */
export const usePurgeFeedbackDataset = () => {
  const isPurgingRef = useRef(false);
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (variables: { datasetId: string }) => purgeFeedbackDataset(variables.datasetId),
  });

  /**
   * Start a purge unless one is already in flight.
   *
   * Resolves to `true` when this call sent the request and owns the outcome, `false` when it was
   * skipped because an earlier call is still running — the caller should then stay silent rather
   * than report a second outcome for the same user action. Rejects exactly as `mutateAsync` does,
   * so the caller's error handling is unchanged.
   */
  const purgeDatasetOnce = useCallback(
    async (datasetId: string): Promise<boolean> => {
      if (isPurgingRef.current) return false;
      isPurgingRef.current = true;

      try {
        await mutateAsync({ datasetId });
        return true;
      } finally {
        isPurgingRef.current = false;
      }
    },
    [mutateAsync]
  );

  return { purgeDatasetOnce, isPending };
};
