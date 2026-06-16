import { placeholderWorkflows } from "@/modules/workflows/lib/placeholder-data";
import { WorkflowsListPage } from "@/modules/workflows/pages/workflows-list-page";

const WorkflowsPage = async (props: Readonly<{ params: Promise<{ workspaceId: string }> }>) => {
  const params = await props.params;

  return <WorkflowsListPage workspaceId={params.workspaceId} workflows={placeholderWorkflows} />;
};

export default WorkflowsPage;
