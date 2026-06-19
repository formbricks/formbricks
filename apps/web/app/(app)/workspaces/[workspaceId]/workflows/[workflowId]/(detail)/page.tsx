import { notFound } from "next/navigation";
import { getWorkflowsRouteAuth } from "@/modules/workflows/lib/auth";
import { loadWorkflowResource } from "@/modules/workflows/lib/server-data";
import { WorkflowBuilderPage } from "@/modules/workflows/pages/workflow-builder-page";

const WorkflowPage = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; workflowId: string }> }>
) => {
  const params = await props.params;
  const { isReadOnly } = await getWorkflowsRouteAuth(params.workspaceId);
  const workflow = await loadWorkflowResource(params.workflowId);

  if (!workflow || workflow.workspaceId !== params.workspaceId) {
    notFound();
  }

  return <WorkflowBuilderPage workflowId={params.workflowId} isReadOnly={isReadOnly} />;
};

export default WorkflowPage;
