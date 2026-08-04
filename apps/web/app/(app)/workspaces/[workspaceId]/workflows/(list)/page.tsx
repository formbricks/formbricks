import { getWorkflowsRouteAuth } from "@/modules/ee/workflows/lib/auth";
import { WorkflowsListPage } from "@/modules/ee/workflows/pages/workflows-list-page";

const WORKFLOWS_PER_PAGE = 12;

const WorkflowsPage = async (props: Readonly<{ params: Promise<{ workspaceId: string }> }>) => {
  const params = await props.params;
  const { isReadOnly, isWorkflowsEnabled } = await getWorkflowsRouteAuth(params.workspaceId);

  // Pages render in parallel with the gating layout; contribute nothing when not entitled so the
  // client list page (which fetches through the now-403 workflows API) never mounts.
  if (!isWorkflowsEnabled) {
    return null;
  }

  return (
    <WorkflowsListPage
      workspaceId={params.workspaceId}
      isReadOnly={isReadOnly}
      workflowsPerPage={WORKFLOWS_PER_PAGE}
    />
  );
};

export default WorkflowsPage;
