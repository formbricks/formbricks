"use client";

import { useMutation } from "@tanstack/react-query";
import { purgeFeedbackDataset } from "@/modules/ee/feedback-directory/lib/api-client";

/**
 * Request a purge of every feedback record in a dataset.
 *
 * There is deliberately no optimistic update and nothing to invalidate: the purge runs in the
 * background on the Hub and this screen lists datasets, not records, so there is no local state that
 * "records are gone" would be true of yet. Success here means *accepted*.
 */
export const usePurgeFeedbackDataset = () =>
  useMutation({
    mutationFn: (variables: { datasetId: string }) => purgeFeedbackDataset(variables.datasetId),
  });
