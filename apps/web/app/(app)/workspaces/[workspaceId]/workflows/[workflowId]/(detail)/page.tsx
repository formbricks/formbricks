import { notFound } from "next/navigation";
import { getWorkflowsRouteAuth } from "@/modules/workflows/lib/auth";
import { getPlaceholderWorkflow } from "@/modules/workflows/lib/placeholder-data";
import { WorkflowBuilderPage } from "@/modules/workflows/pages/workflow-builder-page";

const WorkflowPage = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; workflowId: string }> }>
) => {
  const params = await props.params;
  const { isReadOnly } = await getWorkflowsRouteAuth(params.workspaceId);
  const workflow = getPlaceholderWorkflow(params.workflowId);

  if (!workflow) {
    notFound();
  }

  return (
    <WorkflowBuilderPage
      workspaceId={params.workspaceId}
      workflowId={params.workflowId}
      isReadOnly={isReadOnly}
    />
  );
};

export default WorkflowPage;
