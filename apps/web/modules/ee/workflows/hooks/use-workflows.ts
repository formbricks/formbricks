"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
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
        signal,
      }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });

  const workflows = flattenWorkflowPages(query.data);

  return {
    ...query,
    queryKey,
    workflows,
  };
};
