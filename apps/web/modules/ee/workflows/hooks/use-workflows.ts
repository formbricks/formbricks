"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { TWorkflowSortBy, TWorkflowStatus } from "@formbricks/workflows";
import { listWorkflows } from "../lib/api-client";
import { flattenWorkflowPages, workflowKeys } from "../lib/query";

export const useWorkflows = ({
  workspaceId,
  limit,
  nameContains,
  statusIn,
  sortBy,
  enabled = true,
}: {
  workspaceId: string;
  limit: number;
  nameContains: string;
  statusIn?: TWorkflowStatus[];
  sortBy?: TWorkflowSortBy;
  enabled?: boolean;
}) => {
  const queryKey = workflowKeys.list({ workspaceId, limit, nameContains, statusIn, sortBy });

  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    enabled,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam, signal }) =>
      listWorkflows({
        workspaceId,
        limit,
        cursor: pageParam,
        filters: { nameContains, statusIn, sortBy },
        // The match count only needs computing once per filter change, not on every page.
        includeTotalCount: pageParam === null,
        signal,
      }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });

  // Stable between renders: a table fed a new array each render resets its state and re-renders forever.
  const workflows = useMemo(() => flattenWorkflowPages(query.data), [query.data]);
  const totalCount = query.data?.pages[0]?.meta.totalCount ?? null;

  return {
    ...query,
    queryKey,
    workflows,
    totalCount,
  };
};
