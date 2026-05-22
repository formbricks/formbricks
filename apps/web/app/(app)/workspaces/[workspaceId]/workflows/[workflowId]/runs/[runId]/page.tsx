import { WorkflowRunDetailPage } from "@/modules/workflows/pages/workflow-run-detail-page";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

const WorkflowRunDetail = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; workflowId: string; runId: string }> }>
) => {
  const { workspaceId, workflowId, runId } = await props.params;
  await getWorkspaceAuth(workspaceId);

  return <WorkflowRunDetailPage workspaceId={workspaceId} workflowId={workflowId} runId={runId} />;
};

export default WorkflowRunDetail;
