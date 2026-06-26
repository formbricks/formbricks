"use client";

import { WorkflowRunsTable } from "@/modules/workflows/components/runs/workflow-runs-table";
import { useWorkflowRuns } from "../hooks/use-workflow-runs";

const RUNS_PER_PAGE = 20;

interface WorkflowRunsPageProps {
  workspaceId: string;
  workflowId: string;
}

export const WorkflowRunsPage = ({ workspaceId, workflowId }: Readonly<WorkflowRunsPageProps>) => {
  const { runs, isLoading, isError, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useWorkflowRuns({ workspaceId, limit: RUNS_PER_PAGE, filters: { workflowId } });

  return (
    <WorkflowRunsTable
      runs={runs}
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
