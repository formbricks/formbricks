"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { type TRetentionRunListInput, listRetentionRuns } from "../lib/api-client";
import { flattenRetentionRunPages, retentionRunKeys } from "../lib/query";

/** History, newest first, one keyset page at a time ("Load more"). */
export const useRetentionRuns = ({
  enabled = true,
  ...input
}: TRetentionRunListInput & { enabled?: boolean }) => {
  const queryKey = retentionRunKeys.list(input);

  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    enabled,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam, signal }) => listRetentionRuns({ ...input, cursor: pageParam, signal }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });

  return { ...query, queryKey, runs: flattenRetentionRunPages(query.data) };
};
