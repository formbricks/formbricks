import type { InfiniteData } from "@tanstack/react-query";
import type {
  TWorkflowListItem,
  TWorkflowRunListItem,
  TWorkflowSortBy,
  TWorkflowStatus,
} from "@formbricks/workflows";
import type { TWorkflowListPage, TWorkflowRunListFilters, TWorkflowRunListPage } from "./api-client";

export interface TWorkflowListKeyInput {
  workspaceId: string;
  limit: number;
  nameContains: string;
  statusIn?: TWorkflowStatus[];
  sortBy?: TWorkflowSortBy;
}

export const workflowKeys = {
  all: ["workflows"] as const,
  lists: () => [...workflowKeys.all, "list"] as const,
  list: (input: TWorkflowListKeyInput) => [...workflowKeys.lists(), input] as const,
  details: () => [...workflowKeys.all, "detail"] as const,
  detail: (workflowId: string) => [...workflowKeys.details(), workflowId] as const,
};

export function flattenWorkflowPages(data?: InfiniteData<TWorkflowListPage>): TWorkflowListItem[] {
  return data?.pages.flatMap((page) => page.data) ?? [];
}

export interface TWorkflowRunListKeyInput {
  workspaceId: string;
  limit: number;
  filters?: TWorkflowRunListFilters;
}

export const workflowRunKeys = {
  all: ["workflow-runs"] as const,
  lists: () => [...workflowRunKeys.all, "list"] as const,
  list: (input: TWorkflowRunListKeyInput) => [...workflowRunKeys.lists(), input] as const,
  details: () => [...workflowRunKeys.all, "detail"] as const,
  detail: (runId: string) => [...workflowRunKeys.details(), runId] as const,
};

export function flattenWorkflowRunPages(data?: InfiniteData<TWorkflowRunListPage>): TWorkflowRunListItem[] {
  return data?.pages.flatMap((page) => page.data) ?? [];
}

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
