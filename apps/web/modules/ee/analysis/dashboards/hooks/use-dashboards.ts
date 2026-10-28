"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { type TDashboardListFilters, listDashboards } from "@/modules/ee/analysis/lib/api-client";
import { dashboardKeys, flattenPages } from "@/modules/ee/analysis/lib/query";

/** A workspace's dashboards, newest first, one page at a time. */
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

  return { ...query, queryKey, dashboards: flattenPages(query.data) };
};
