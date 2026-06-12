import type { TFunction } from "i18next";
import { WorkflowRunsTable } from "../components/workflow-runs-table";
import { WorkflowPageLayout } from "./workflow-page-layout";

interface WorkspaceWorkflowRunsPageProps {
  t: TFunction;
  workspaceId: string;
}

export const WorkspaceWorkflowRunsPage = ({ t, workspaceId }: Readonly<WorkspaceWorkflowRunsPageProps>) => {
  return (
    <WorkflowPageLayout pageTitle={t("common.workflow_runs")}>
      <WorkflowRunsTable t={t} workspaceId={workspaceId} showWorkflowColumn />
    </WorkflowPageLayout>
  );
};
