"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCreative, patchCreative } from "../lib/editor-api";
import type { TCreativeResource } from "../lib/editor-form";
import { creativeListKeys } from "../lib/list-api";
import type { TSummaryStatus } from "../lib/summary";
import { creativeSummaryKeys, getCreativeStats } from "../lib/summary-api";

/**
 * The creative behind the summary header. The page loads it on the server, so the query starts with
 * that resource; Refresh and status changes are what update it.
 */
export const useSummaryCreative = (initialCreative: TCreativeResource) =>
  useQuery({
    queryKey: creativeSummaryKeys.creative(initialCreative.id),
    queryFn: ({ signal }) => getCreative(initialCreative.id, signal),
    initialData: initialCreative,
    staleTime: Infinity,
  });

/** The counts for one range. A new range keeps the last counts on screen until its own arrive. */
export const useCreativeStats = (creativeId: string, query: string) =>
  useQuery({
    queryKey: creativeSummaryKeys.stats(creativeId, query),
    queryFn: ({ signal }) => getCreativeStats(creativeId, query, signal),
    placeholderData: keepPreviousData,
  });

/** Pauses, closes or reopens the creative through `PATCH status`, then refreshes the list behind it. */
export const useChangeCreativeStatus = (creativeId: string) => {
  const queryClient = useQueryClient();
  return useMutation<TCreativeResource, Error, TSummaryStatus>({
    mutationFn: (status) => patchCreative(creativeId, { status }),
    onSuccess: async (creative) => {
      queryClient.setQueryData(creativeSummaryKeys.creative(creativeId), creative);
      await queryClient.invalidateQueries({ queryKey: creativeListKeys.all });
    },
  });
};
