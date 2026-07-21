"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { type TWorkflowRunListFilters, listWorkflowRuns } from "../lib/api-client";
import { flattenWorkflowRunPages, workflowRunKeys } from "../lib/query";

// Keyset-paginated run list, mirroring use-workflows. The runs list is fixed newest-first; filters
// (workflowId / responseId / statusIn / isDryRun) are part of the query key so a filter change
// starts a fresh page sequence while keepPreviousData avoids a flash of empty state.
export const useWorkflowRuns = ({
  workspaceId,
  limit,
  filters,
  enabled = true,
}: {
  workspaceId: string;
  limit: number;
  filters?: TWorkflowRunListFilters;
  enabled?: boolean;
}) => {
  const queryKey = workflowRunKeys.list({ workspaceId, limit, filters });

  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    enabled,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam, signal }) =>
      listWorkflowRuns({ workspaceId, limit, cursor: pageParam, filters, signal }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });

  const runs = flattenWorkflowRunPages(query.data);

  return {
    ...query,
    queryKey,
    runs,
  };
};
