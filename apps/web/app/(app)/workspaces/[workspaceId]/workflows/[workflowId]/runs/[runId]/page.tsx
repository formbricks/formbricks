import { notFound } from "next/navigation";
import { getWorkflowsRouteAuth } from "@/modules/workflows/lib/auth";
import { getPlaceholderWorkflowRun } from "@/modules/workflows/lib/placeholder-data";
import { WorkflowRunDetailPage } from "@/modules/workflows/pages/workflow-run-detail-page";

const WorkflowRunDetail = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; workflowId: string; runId: string }> }>
) => {
  const params = await props.params;
  await getWorkflowsRouteAuth(params.workspaceId);

  if (!getPlaceholderWorkflowRun(params.workflowId, params.runId)) {
    notFound();
  }

  return (
    <WorkflowRunDetailPage
      workspaceId={params.workspaceId}
      workflowId={params.workflowId}
      runId={params.runId}
    />
  );
};

export default WorkflowRunDetail;
