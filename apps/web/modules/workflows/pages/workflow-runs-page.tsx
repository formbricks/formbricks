"use client";

import { useTranslation } from "react-i18next";
import { WorkflowRunsTable } from "../components/workflow-runs-table";
import { WorkflowSecondaryNavigation } from "../components/workflow-secondary-navigation";
import { WorkflowPageLayout } from "./workflow-page-layout";

interface WorkflowRunsPageProps {
  workflowId: string;
  workspaceId: string;
}

export const WorkflowRunsPage = ({ workflowId, workspaceId }: Readonly<WorkflowRunsPageProps>) => {
  const { t } = useTranslation();

  return (
    <WorkflowPageLayout
      pageTitle={t("common.workflow_runs")}
      navigation={
        <WorkflowSecondaryNavigation activeId="runs" workflowId={workflowId} workspaceId={workspaceId} />
      }>
      <WorkflowRunsTable workspaceId={workspaceId} workflowId={workflowId} />
    </WorkflowPageLayout>
  );
};
