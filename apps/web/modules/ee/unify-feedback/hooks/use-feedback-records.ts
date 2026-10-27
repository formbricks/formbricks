"use client";

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { countDirectoryRecords, listDirectoryRecords, sortRecords } from "../lib/records-client";
import type { THubRecordQuery } from "../lib/table-filters";

type TRecordsPage = { records: FeedbackRecordData[]; cursors: Record<string, string> };

export const feedbackRecordKeys = {
  all: ["feedback-records"] as const,
  list: (workspaceId: string, directoryIds: readonly string[], query: THubRecordQuery | null) =>
    [...feedbackRecordKeys.all, "list", workspaceId, directoryIds, query] as const,
  count: (workspaceId: string, directoryIds: readonly string[], query: THubRecordQuery | null) =>
    [...feedbackRecordKeys.all, "count", workspaceId, directoryIds, query] as const,
};

/**
 * Feedback records across every directory this workspace can read, filtered and sorted on the Hub.
 * The first page asks every directory; "Load more" asks only those with a cursor left. The match count
 * is the sum of each directory's count. A null query means the filters match nothing.
 */
export const useFeedbackRecords = ({
  workspaceId,
  directoryIds,
  query,
}: {
  workspaceId: string;
  directoryIds: readonly string[];
  query: THubRecordQuery | null;
}) => {
  const enabled = query !== null && directoryIds.length > 0;

  const list = useInfiniteQuery({
    queryKey: feedbackRecordKeys.list(workspaceId, directoryIds, query),
    initialPageParam: null as Record<string, string> | null,
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam, signal }): Promise<TRecordsPage> => {
      const targets = pageParam ? Object.keys(pageParam) : [...directoryIds];
      const pages = await Promise.all(
        targets.map((tenantId) =>
          listDirectoryRecords({ tenantId, query: query!, cursor: pageParam?.[tenantId], signal })
        )
      );
      const cursors: Record<string, string> = {};
      pages.forEach((page, index) => {
        if (page.nextCursor) cursors[targets[index]] = page.nextCursor;
      });
      return { records: pages.flatMap((page) => page.records), cursors };
    },
    getNextPageParam: (lastPage) => (Object.keys(lastPage.cursors).length > 0 ? lastPage.cursors : undefined),
  });

  const count = useQuery({
    queryKey: feedbackRecordKeys.count(workspaceId, directoryIds, query),
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const counts = await Promise.all(
        directoryIds.map((tenantId) => countDirectoryRecords({ tenantId, query: query!, signal }))
      );
      return counts.reduce((sum, value) => sum + value, 0);
    },
  });

  const records = useMemo(
    () => (query ? sortRecords(list.data?.pages.flatMap((page) => page.records) ?? [], query) : []),
    [list.data, query]
  );

  return {
    records,
    isLoading: enabled && list.isLoading,
    isError: list.isError,
    error: list.error,
    hasNextPage: enabled && list.hasNextPage,
    isFetchingNextPage: list.isFetchingNextPage,
    fetchNextPage: list.fetchNextPage,
    // `refetch` resolves even when the request fails; rethrow so Refresh reports the failure. It also
    // ignores `enabled`, so with nothing to ask (a filter that matches nothing, no directory) it would
    // run the query function anyway and fail — there is nothing to refresh.
    refetch: async () => {
      if (!enabled) return;
      const [listResult, countResult] = await Promise.all([list.refetch(), count.refetch()]);
      const failed = [listResult, countResult].find((result) => result.isError);
      if (failed) throw failed.error;
    },
    matchCount: query === null ? 0 : (count.data ?? null),
  };
};
