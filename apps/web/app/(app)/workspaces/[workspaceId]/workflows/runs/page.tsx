import { WorkspaceWorkflowRunsPage } from "@/modules/workflows/pages/workspace-workflow-runs-page";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

const WorkflowRuns = async (props: Readonly<{ params: Promise<{ workspaceId: string }> }>) => {
  const { workspaceId } = await props.params;
  await getWorkspaceAuth(workspaceId);

  return <WorkspaceWorkflowRunsPage workspaceId={workspaceId} />;
};

export default WorkflowRuns;
