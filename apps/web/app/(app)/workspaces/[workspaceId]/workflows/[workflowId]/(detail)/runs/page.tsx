import { WorkflowRunsPage } from "@/modules/workflows/pages/workflow-runs-page";

const WorkflowRuns = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; workflowId: string }> }>
) => {
  const { workspaceId, workflowId } = await props.params;
  return <WorkflowRunsPage workspaceId={workspaceId} workflowId={workflowId} />;
};

export default WorkflowRuns;
