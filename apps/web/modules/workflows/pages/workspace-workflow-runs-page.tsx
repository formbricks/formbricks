"use client";

import { WorkflowRunsTable } from "@/modules/workflows/components/runs/workflow-runs-table";
import { useWorkflowRuns } from "../hooks/use-workflow-runs";

const RUNS_PER_PAGE = 20;

interface WorkspaceWorkflowRunsPageProps {
  workspaceId: string;
}

export const WorkspaceWorkflowRunsPage = ({ workspaceId }: Readonly<WorkspaceWorkflowRunsPageProps>) => {
  const { runs, isLoading, isError, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useWorkflowRuns({ workspaceId, limit: RUNS_PER_PAGE });

  return (
    <WorkflowRunsTable
      runs={runs}
      showWorkflowColumn
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={() => fetchNextPage()}
    />
  );
};
