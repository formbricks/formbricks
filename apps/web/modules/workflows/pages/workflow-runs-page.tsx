import type { TFunction } from "i18next";
import { WorkflowRunsTable } from "../components/workflow-runs-table";
import { WorkflowSecondaryNavigation } from "../components/workflow-secondary-navigation";
import { WorkflowPageLayout } from "./workflow-page-layout";

interface WorkflowRunsPageProps {
  t: TFunction;
  workflowId: string;
  workspaceId: string;
}

export const WorkflowRunsPage = ({ t, workflowId, workspaceId }: Readonly<WorkflowRunsPageProps>) => {
  return (
    <WorkflowPageLayout
      pageTitle={t("common.workflow_runs")}
      navigation={
        <WorkflowSecondaryNavigation
          activeId="runs"
          t={t}
          workflowId={workflowId}
          workspaceId={workspaceId}
        />
      }>
      <WorkflowRunsTable t={t} workspaceId={workspaceId} workflowId={workflowId} />
    </WorkflowPageLayout>
  );
};
