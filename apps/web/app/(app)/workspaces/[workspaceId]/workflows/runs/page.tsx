import { getWorkflowsRouteAuth } from "@/modules/workflows/lib/auth";
import { WorkspaceWorkflowRunsPage } from "@/modules/workflows/pages/workspace-workflow-runs-page";

const WorkflowRunsPage = async (props: Readonly<{ params: Promise<{ workspaceId: string }> }>) => {
  const params = await props.params;
  await getWorkflowsRouteAuth(params.workspaceId);

  return <WorkspaceWorkflowRunsPage workspaceId={params.workspaceId} />;
};

export default WorkflowRunsPage;
