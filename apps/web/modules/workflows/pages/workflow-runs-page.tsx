"use client";

import { WorkflowRunsTable } from "@/modules/workflows/components/workflow-runs-table";
import { type TWorkflowRunListItem } from "@/modules/workflows/types";

interface WorkflowRunsPageProps {
  runs: TWorkflowRunListItem[];
}

export const WorkflowRunsPage = ({ runs }: Readonly<WorkflowRunsPageProps>) => {
  return <WorkflowRunsTable runs={runs} />;
};
