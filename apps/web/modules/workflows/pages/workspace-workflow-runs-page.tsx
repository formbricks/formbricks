import type { TFunction } from "i18next";
import { WorkflowRunsTable } from "../components/workflow-runs-table";
import { WorkspaceWorkflowsSecondaryNavigation } from "../components/workspace-workflows-secondary-navigation";
import { WorkflowPageLayout } from "./workflow-page-layout";

interface WorkspaceWorkflowRunsPageProps {
  t: TFunction;
  workspaceId: string;
}

export const WorkspaceWorkflowRunsPage = ({ t, workspaceId }: Readonly<WorkspaceWorkflowRunsPageProps>) => {
  return (
    <WorkflowPageLayout
      pageTitle={t("common.workflows")}
      navigation={<WorkspaceWorkflowsSecondaryNavigation activeId="runs" t={t} workspaceId={workspaceId} />}>
      <WorkflowRunsTable t={t} workspaceId={workspaceId} showWorkflowColumn />
    </WorkflowPageLayout>
  );
};
