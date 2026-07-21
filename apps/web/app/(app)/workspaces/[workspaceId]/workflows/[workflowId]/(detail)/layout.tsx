import type { ReactNode } from "react";
import { WorkflowEditorProvider } from "@/modules/ee/workflows/components/workflow-editor-provider";
import { WorkflowHeaderCta } from "@/modules/ee/workflows/components/workflow-header-cta";
import { WorkflowPageTitle } from "@/modules/ee/workflows/components/workflow-page-title";
import { WorkflowSecondaryNavigation } from "@/modules/ee/workflows/components/workflow-secondary-navigation";
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
  const { isReadOnly } = await getWorkflowsRouteAuth(params.workspaceId);

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
