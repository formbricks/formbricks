"use client";

import { WorkflowRunsTable } from "@/modules/workflows/components/workflow-runs-table";
import { type TWorkflowRunListItem } from "@/modules/workflows/types";

interface WorkspaceWorkflowRunsPageProps {
  runs: TWorkflowRunListItem[];
}

export const WorkspaceWorkflowRunsPage = ({ runs }: Readonly<WorkspaceWorkflowRunsPageProps>) => {
  return <WorkflowRunsTable runs={runs} showWorkflowColumn />;
};
