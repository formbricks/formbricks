import type { InfiniteData } from "@tanstack/react-query";
import type { TWorkflowListItem } from "@formbricks/workflows";
import type { TWorkflowListPage } from "./v3-workflows-client";

interface TWorkflowListKeyInput {
  workspaceId: string;
  limit: number;
}

export const workflowKeys = {
  all: ["workflows"] as const,
  lists: () => [...workflowKeys.all, "list"] as const,
  list: (input: TWorkflowListKeyInput) => [...workflowKeys.lists(), input] as const,
};

export function flattenWorkflowPages(data?: InfiniteData<TWorkflowListPage>): TWorkflowListItem[] {
  return data?.pages.flatMap((page) => page.data) ?? [];
}
