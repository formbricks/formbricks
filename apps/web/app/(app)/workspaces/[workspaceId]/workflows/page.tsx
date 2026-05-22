import { WorkflowsListPage } from "@/modules/workflows/pages/workflows-list-page";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

const WorkflowsPage = async (props: Readonly<{ params: Promise<{ workspaceId: string }> }>) => {
  const { workspaceId } = await props.params;
  const { isReadOnly } = await getWorkspaceAuth(workspaceId);

  return <WorkflowsListPage workspaceId={workspaceId} isReadOnly={isReadOnly} />;
};

export default WorkflowsPage;
