import { notFound } from "next/navigation";
import { getPlaceholderWorkflowRun } from "@/modules/workflows/lib/placeholder-data";
import { WorkflowRunDetailPage } from "@/modules/workflows/pages/workflow-run-detail-page";

const WorkflowRunDetail = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; workflowId: string; runId: string }> }>
) => {
  const params = await props.params;

  if (!getPlaceholderWorkflowRun(params.workflowId, params.runId)) {
    notFound();
  }

  return <WorkflowRunDetailPage workflowId={params.workflowId} runId={params.runId} />;
};

export default WorkflowRunDetail;
