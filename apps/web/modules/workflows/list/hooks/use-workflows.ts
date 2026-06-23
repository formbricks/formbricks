"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { flattenWorkflowPages, workflowKeys } from "@/modules/workflows/list/lib/query";
import { listWorkflows } from "@/modules/workflows/list/lib/v3-workflows-client";

interface UseWorkflowsArgs {
  workspaceId: string;
  limit: number;
  enabled?: boolean;
}

export const useWorkflows = ({ workspaceId, limit, enabled = true }: UseWorkflowsArgs) => {
  const queryKey = workflowKeys.list({ workspaceId, limit });

  const query = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: null as string | null,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam, signal }) => listWorkflows({ workspaceId, limit, cursor: pageParam, signal }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });

  return {
    ...query,
    queryKey,
    workflows: flattenWorkflowPages(query.data),
  };
};
