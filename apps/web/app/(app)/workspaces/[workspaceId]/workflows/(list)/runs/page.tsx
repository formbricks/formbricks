import { WorkspaceWorkflowRunsPage } from "@/modules/workflows/pages/workspace-workflow-runs-page";

const WorkflowRunsPage = async (props: Readonly<{ params: Promise<{ workspaceId: string }> }>) => {
  const { workspaceId } = await props.params;
  return <WorkspaceWorkflowRunsPage workspaceId={workspaceId} />;
};

export default WorkflowRunsPage;
