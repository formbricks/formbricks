import { getWorkflowsRouteAuth } from "@/modules/workflows/lib/auth";
import { WorkflowsListPage } from "@/modules/workflows/pages/workflows-list-page";

// One cursor page size for the workflows list (matches the surveys list page size).
const WORKFLOWS_PER_PAGE = 12;

const WorkflowsPage = async (props: Readonly<{ params: Promise<{ workspaceId: string }> }>) => {
  const params = await props.params;
  const { isReadOnly } = await getWorkflowsRouteAuth(params.workspaceId);

  return (
    <WorkflowsListPage
      workspaceId={params.workspaceId}
      isReadOnly={isReadOnly}
      workflowsPerPage={WORKFLOWS_PER_PAGE}
    />
  );
};

export default WorkflowsPage;
