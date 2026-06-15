"use client";

import { useTranslation } from "react-i18next";
import { WorkflowRunsTable } from "../components/workflow-runs-table";
import { WorkspaceWorkflowsSecondaryNavigation } from "../components/workspace-workflows-secondary-navigation";
import { WorkflowPageLayout } from "./workflow-page-layout";

interface WorkspaceWorkflowRunsPageProps {
  workspaceId: string;
}

export const WorkspaceWorkflowRunsPage = ({ workspaceId }: Readonly<WorkspaceWorkflowRunsPageProps>) => {
  const { t } = useTranslation();

  return (
    <WorkflowPageLayout
      pageTitle={t("common.workflows")}
      navigation={<WorkspaceWorkflowsSecondaryNavigation activeId="runs" workspaceId={workspaceId} />}>
      <WorkflowRunsTable workspaceId={workspaceId} showWorkflowColumn />
    </WorkflowPageLayout>
  );
};
