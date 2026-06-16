"use client";

import { WorkflowRunsTable } from "../components/workflow-runs-table";
import { type TWorkflowRunListItem } from "../types";

interface WorkflowRunsPageProps {
  runs: TWorkflowRunListItem[];
}

export const WorkflowRunsPage = ({ runs }: Readonly<WorkflowRunsPageProps>) => {
  return <WorkflowRunsTable runs={runs} />;
};
