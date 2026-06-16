import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { WorkflowHeaderCta } from "@/modules/workflows/components/workflow-header-cta";
import { WorkflowSecondaryNavigation } from "@/modules/workflows/components/workflow-secondary-navigation";
import { getWorkflowsRouteAuth } from "@/modules/workflows/lib/auth";
import { getPlaceholderWorkflow } from "@/modules/workflows/lib/placeholder-data";

const WorkflowDetailLayout = async (
  props: Readonly<{
    params: Promise<{ workspaceId: string; workflowId: string }>;
    children: ReactNode;
  }>
) => {
  const params = await props.params;
  const { isReadOnly } = await getWorkflowsRouteAuth(params.workspaceId);
  const workflow = getPlaceholderWorkflow(params.workflowId);

  if (!workflow) {
    notFound();
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={workflow.name} cta={<WorkflowHeaderCta isReadOnly={isReadOnly} />}>
        <WorkflowSecondaryNavigation workspaceId={params.workspaceId} workflowId={params.workflowId} />
      </PageHeader>
      {props.children}
    </PageContentWrapper>
  );
};

export default WorkflowDetailLayout;
