"use client";

import { WorkflowRunsTable } from "../components/workflow-runs-table";
import { type TWorkflowRunListItem } from "../types";

interface WorkspaceWorkflowRunsPageProps {
  runs: TWorkflowRunListItem[];
}

export const WorkspaceWorkflowRunsPage = ({ runs }: Readonly<WorkspaceWorkflowRunsPageProps>) => {
  return <WorkflowRunsTable runs={runs} showWorkflowColumn />;
};
