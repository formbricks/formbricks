"use client";

import { useState } from "react";
import { HideTestRunsSwitch } from "@/modules/ee/workflows/components/runs/hide-test-runs-switch";
import { WorkflowRunsTable } from "@/modules/ee/workflows/components/runs/workflow-runs-table";
import { withTestRunsHidden } from "@/modules/ee/workflows/lib/test-run";
import { useTrackWorkflowSurface } from "../hooks/use-track-workflow-surface";
import { useWorkflowRuns } from "../hooks/use-workflow-runs";

const RUNS_PER_PAGE = 20;

interface WorkflowRunsPageProps {
  workspaceId: string;
  workflowId: string;
}

export const WorkflowRunsPage = ({ workspaceId, workflowId }: Readonly<WorkflowRunsPageProps>) => {
  const [hideTestRuns, setHideTestRuns] = useState(true);
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
  } = useWorkflowRuns({
    workspaceId,
    limit: RUNS_PER_PAGE,
    filters: withTestRunsHidden({ workflowId }, hideTestRuns),
  });
  useTrackWorkflowSurface("workflow_runs", { workflowId });

  return (
    <div className="flex flex-col gap-3">
      <HideTestRunsSwitch checked={hideTestRuns} onCheckedChange={setHideTestRuns} />
      <WorkflowRunsTable
        runs={runs}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        isFetchNextPageError={isFetchNextPageError}
        onLoadMore={() => fetchNextPage()}
      />
    </div>
  );
};
