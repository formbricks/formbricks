"use client";

import { WorkflowRunsTable } from "../components/workflow-runs-table";
import { type TPlaceholderWorkflowRunListItem } from "../lib/placeholder-data";

interface WorkflowRunsPageProps {
  runs: TPlaceholderWorkflowRunListItem[];
}

export const WorkflowRunsPage = ({ runs }: Readonly<WorkflowRunsPageProps>) => {
  return <WorkflowRunsTable runs={runs} />;
};
