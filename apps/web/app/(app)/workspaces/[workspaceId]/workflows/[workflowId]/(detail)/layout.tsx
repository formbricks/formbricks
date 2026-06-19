import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { WorkflowEditorProvider } from "@/modules/workflows/components/workflow-editor-provider";
import { WorkflowHeaderCta } from "@/modules/workflows/components/workflow-header-cta";
import { WorkflowPageTitle } from "@/modules/workflows/components/workflow-page-title";
import { WorkflowSecondaryNavigation } from "@/modules/workflows/components/workflow-secondary-navigation";
import { getWorkflowsRouteAuth } from "@/modules/workflows/lib/auth";
import { loadWorkflowResource } from "@/modules/workflows/lib/server-data";

const WorkflowDetailLayout = async (
  props: Readonly<{
    params: Promise<{ workspaceId: string; workflowId: string }>;
    children: ReactNode;
  }>
) => {
  const params = await props.params;
  const { isReadOnly } = await getWorkflowsRouteAuth(params.workspaceId);
  const workflow = await loadWorkflowResource(params.workflowId);

  if (!workflow || workflow.workspaceId !== params.workspaceId) {
    notFound();
  }

  return (
    <WorkflowEditorProvider>
      <PageContentWrapper>
        <PageHeader
          pageTitle={<WorkflowPageTitle fallback={workflow.name} />}
          cta={<WorkflowHeaderCta workflowId={params.workflowId} isReadOnly={isReadOnly} />}>
          <WorkflowSecondaryNavigation workspaceId={params.workspaceId} workflowId={params.workflowId} />
        </PageHeader>
        {props.children}
      </PageContentWrapper>
    </WorkflowEditorProvider>
  );
};

export default WorkflowDetailLayout;
