import { WorkflowRunsPage } from "@/modules/workflows/pages/workflow-runs-page";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

const WorkflowRuns = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; workflowId: string }> }>
) => {
  const { workspaceId, workflowId } = await props.params;
  await getWorkspaceAuth(workspaceId);

  return <WorkflowRunsPage workspaceId={workspaceId} workflowId={workflowId} />;
};

export default WorkflowRuns;
