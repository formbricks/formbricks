import { getWorkflowsRouteAuth } from "@/modules/ee/workflows/lib/auth";
import { WorkflowRunsPage } from "@/modules/ee/workflows/pages/workflow-runs-page";

const WorkflowRuns = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; workflowId: string }> }>
) => {
  const { workspaceId, workflowId } = await props.params;
  const { isReadOnly, isWorkflowsEnabled } = await getWorkflowsRouteAuth(workspaceId);
  // Pages render in parallel with the gating layout; contribute nothing when not entitled so the
  // Runs view never mounts against the now-403 API.
  if (!isWorkflowsEnabled) return null;
  return <WorkflowRunsPage workspaceId={workspaceId} workflowId={workflowId} isReadOnly={isReadOnly} />;
};

export default WorkflowRuns;
