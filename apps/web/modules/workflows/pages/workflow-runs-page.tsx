"use client";

import { WorkflowRunsTable } from "../components/workflow-runs-table";

interface WorkflowRunsPageProps {
  workflowId: string;
  workspaceId: string;
}

export const WorkflowRunsPage = ({ workflowId, workspaceId }: Readonly<WorkflowRunsPageProps>) => {
  return <WorkflowRunsTable workspaceId={workspaceId} workflowId={workflowId} />;
};
