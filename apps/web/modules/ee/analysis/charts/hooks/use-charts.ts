"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { type TChartListFilters, listCharts } from "@/modules/ee/analysis/lib/api-client";
import { chartKeys, flattenPages } from "@/modules/ee/analysis/lib/query";

/** A workspace's charts, newest first, one page at a time. */
export const useCharts = ({
  workspaceId,
  limit,
  enabled = true,
  ...filters
}: { workspaceId: string; limit: number; enabled?: boolean } & TChartListFilters) => {
  const queryKey = chartKeys.list({ workspaceId, limit, ...filters });

  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    enabled,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam, signal }) =>
      listCharts({ workspaceId, limit, cursor: pageParam, filters, signal }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });

  return { ...query, queryKey, charts: flattenPages(query.data) };
};
