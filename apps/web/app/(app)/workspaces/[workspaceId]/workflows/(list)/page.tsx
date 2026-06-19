import { loadWorkspaceWorkflowList } from "@/modules/workflows/lib/server-data";
import { WorkflowsListPage } from "@/modules/workflows/pages/workflows-list-page";

const WorkflowsPage = async (props: Readonly<{ params: Promise<{ workspaceId: string }> }>) => {
  const params = await props.params;
  const workflows = await loadWorkspaceWorkflowList(params.workspaceId);

  return <WorkflowsListPage workspaceId={params.workspaceId} workflows={workflows} />;
};

export default WorkflowsPage;
