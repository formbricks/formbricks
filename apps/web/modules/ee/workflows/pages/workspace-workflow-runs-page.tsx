"use client";

import { WorkflowRunsTable } from "@/modules/ee/workflows/components/runs/workflow-runs-table";
import { useTrackWorkflowSurface } from "../hooks/use-track-workflow-surface";

interface WorkspaceWorkflowRunsPageProps {
  workspaceId: string;
}

export const WorkspaceWorkflowRunsPage = ({ workspaceId }: Readonly<WorkspaceWorkflowRunsPageProps>) => {
  useTrackWorkflowSurface("workspace_runs");
  return <WorkflowRunsTable workspaceId={workspaceId} />;
};
