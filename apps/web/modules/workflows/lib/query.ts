import type { InfiniteData } from "@tanstack/react-query";
import type { TWorkflowListItem, TWorkflowSortBy, TWorkflowStatus } from "@formbricks/workflows";
import type { TWorkflowListPage } from "./api-client";

export interface TWorkflowListKeyInput {
  workspaceId: string;
  limit: number;
  nameContains: string;
  statusIn?: TWorkflowStatus[];
  sortBy?: TWorkflowSortBy;
}

/**
 * Query-key factory for the workflows list, mirroring `modules/survey/list/lib/query.ts`. The
 * full input (workspace + paging + search/filter) is part of the key so a search-term change is a
 * distinct query that refetches from page 1 rather than filtering already-loaded pages.
 */
export const workflowKeys = {
  all: ["workflows"] as const,
  lists: () => [...workflowKeys.all, "list"] as const,
  list: (input: TWorkflowListKeyInput) => [...workflowKeys.lists(), input] as const,
};

export function flattenWorkflowPages(data?: InfiniteData<TWorkflowListPage>): TWorkflowListItem[] {
  return data?.pages.flatMap((page) => page.data) ?? [];
}

/** Drop a workflow from every loaded page — used for optimistic archive/delete cache updates. */
export function removeWorkflowFromInfiniteData(
  data: InfiniteData<TWorkflowListPage> | undefined,
  workflowId: string
): InfiniteData<TWorkflowListPage> | undefined {
  if (!data) {
    return data;
  }

  let workflowWasRemoved = false;

  const pages = data.pages.map((page) => {
    const nextData = page.data.filter((workflow) => workflow.id !== workflowId);
    if (nextData.length !== page.data.length) {
      workflowWasRemoved = true;
    }

    return { ...page, data: nextData };
  });

  if (!workflowWasRemoved) {
    return data;
  }

  return { ...data, pages };
}
