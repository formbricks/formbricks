"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { type TDashboardListFilters, listDashboards } from "@/modules/ee/analysis/lib/api-client";
import { dashboardKeys, flattenPages } from "@/modules/ee/analysis/lib/query";
import { shouldWalkPastEmptyPage } from "../lib/empty-page-walk";

/**
 * A workspace's dashboards, newest first, one page at a time. An empty page with a next cursor (a
 * Dashboard Viewer's scan ceiling) is walked past on its own, a batch at a time (`shouldWalkPastEmptyPage`);
 * `isWalkingEmptyPages` is true while the walk is about to fetch its next page.
 */
export const useDashboards = ({
  workspaceId,
  limit,
  enabled = true,
  ...filters
}: { workspaceId: string; limit: number; enabled?: boolean } & TDashboardListFilters) => {
  const queryKey = dashboardKeys.list({ workspaceId, limit, ...filters });

  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    enabled,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam, signal }) =>
      listDashboards({ workspaceId, limit, cursor: pageParam, filters, signal }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });

  const walkPastEmptyPage = shouldWalkPastEmptyPage({
    pages: query.data?.pages,
    hasNextPage: query.hasNextPage,
    isFetching: query.isFetching,
    isError: query.isError,
  });
  const { fetchNextPage } = query;
  // Keyed on the page count too: a fast page can land in the same render that started it, leaving
  // `walkPastEmptyPage` true throughout, and the walk must still fetch once per page it receives.
  const pageCount = query.data?.pages.length ?? 0;
  useEffect(() => {
    if (walkPastEmptyPage) void fetchNextPage();
  }, [walkPastEmptyPage, pageCount, fetchNextPage]);

  return {
    ...query,
    queryKey,
    dashboards: flattenPages(query.data),
    isWalkingEmptyPages: walkPastEmptyPage,
  };
};
