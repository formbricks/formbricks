import { notFound } from "next/navigation";
import { getWorkflowsRouteAuth } from "@/modules/workflows/lib/auth";
import { getPlaceholderWorkflow } from "@/modules/workflows/lib/placeholder-data";
import { WorkflowRunsPage } from "@/modules/workflows/pages/workflow-runs-page";

const WorkflowRuns = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; workflowId: string }> }>
) => {
  const params = await props.params;
  await getWorkflowsRouteAuth(params.workspaceId);

  if (!getPlaceholderWorkflow(params.workflowId)) {
    notFound();
  }

  return <WorkflowRunsPage workspaceId={params.workspaceId} workflowId={params.workflowId} />;
};

export default WorkflowRuns;
