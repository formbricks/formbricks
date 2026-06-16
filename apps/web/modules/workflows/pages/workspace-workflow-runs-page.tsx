"use client";

import { WorkflowRunsTable } from "../components/workflow-runs-table";
import { type TPlaceholderWorkflowRunListItem } from "../lib/placeholder-data";

interface WorkspaceWorkflowRunsPageProps {
  runs: TPlaceholderWorkflowRunListItem[];
}

export const WorkspaceWorkflowRunsPage = ({ runs }: Readonly<WorkspaceWorkflowRunsPageProps>) => {
  return <WorkflowRunsTable runs={runs} showWorkflowColumn />;
};
