"use client";

import { WorkflowRunsTable } from "@/modules/ee/workflows/components/runs/workflow-runs-table";
import { useTrackWorkflowSurface } from "../hooks/use-track-workflow-surface";
import { useWorkflowRuns } from "../hooks/use-workflow-runs";

const RUNS_PER_PAGE = 20;

interface WorkspaceWorkflowRunsPageProps {
  workspaceId: string;
}

export const WorkspaceWorkflowRunsPage = ({ workspaceId }: Readonly<WorkspaceWorkflowRunsPageProps>) => {
  const {
    runs,
    isLoading,
    isError,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useWorkflowRuns({ workspaceId, limit: RUNS_PER_PAGE });
  useTrackWorkflowSurface("workspace_runs");

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
      isFetchNextPageError={isFetchNextPageError}
      onLoadMore={() => fetchNextPage()}
    />
  );
};
