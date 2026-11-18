"use client";

import { WorkflowRunsTable } from "@/modules/ee/workflows/components/runs/workflow-runs-table";
import { useTrackWorkflowSurface } from "../hooks/use-track-workflow-surface";

interface WorkflowRunsPageProps {
  workspaceId: string;
  workflowId: string;
}

export const WorkflowRunsPage = ({ workspaceId, workflowId }: Readonly<WorkflowRunsPageProps>) => {
  useTrackWorkflowSurface("workflow_runs", { workflowId });
  return <WorkflowRunsTable workspaceId={workspaceId} workflowId={workflowId} />;
};
