import type { ReactNode } from "react";
import { getTranslate } from "@/lingodotdev/server";
import { WorkflowEditorProvider } from "@/modules/ee/workflows/components/workflow-editor-provider";
import { WorkflowHeaderCta } from "@/modules/ee/workflows/components/workflow-header-cta";
import { WorkflowPageTitle } from "@/modules/ee/workflows/components/workflow-page-title";
import { WorkflowSecondaryNavigation } from "@/modules/ee/workflows/components/workflow-secondary-navigation";
import { WorkflowsUpgradePrompt } from "@/modules/ee/workflows/components/workflows-upgrade-prompt";
import { getWorkflowsRouteAuth } from "@/modules/ee/workflows/lib/auth";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const WorkflowDetailLayout = async (
  props: Readonly<{
    params: Promise<{ workspaceId: string; workflowId: string }>;
    children: ReactNode;
  }>
) => {
  const params = await props.params;
  const { isReadOnly, isWorkflowsEnabled, organizationId } = await getWorkflowsRouteAuth(params.workspaceId);

  if (!isWorkflowsEnabled) {
    // Not entitled: plain title instead of WorkflowPageTitle/WorkflowHeaderCta/WorkflowEditorProvider —
    // those fetch the workflow through the now-403 API and must not render broken states. The tabs are
    // static links; both land on this prompt, matching the list layout.
    const t = await getTranslate();
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={t("common.workflows")}>
          <WorkflowSecondaryNavigation workspaceId={params.workspaceId} workflowId={params.workflowId} />
        </PageHeader>
        <WorkflowsUpgradePrompt organizationId={organizationId} />
      </PageContentWrapper>
    );
  }

  return (
    <WorkflowEditorProvider>
      <PageContentWrapper>
        <PageHeader
          pageTitle={<WorkflowPageTitle workflowId={params.workflowId} isReadOnly={isReadOnly} />}
          cta={<WorkflowHeaderCta workflowId={params.workflowId} isReadOnly={isReadOnly} />}>
          <WorkflowSecondaryNavigation workspaceId={params.workspaceId} workflowId={params.workflowId} />
        </PageHeader>
        {props.children}
      </PageContentWrapper>
    </WorkflowEditorProvider>
  );
};

export default WorkflowDetailLayout;
