"use client";

import { WorkflowRunsTable } from "../components/workflow-runs-table";

interface WorkspaceWorkflowRunsPageProps {
  workspaceId: string;
}

export const WorkspaceWorkflowRunsPage = ({ workspaceId }: Readonly<WorkspaceWorkflowRunsPageProps>) => {
  return <WorkflowRunsTable workspaceId={workspaceId} showWorkflowColumn />;
};
