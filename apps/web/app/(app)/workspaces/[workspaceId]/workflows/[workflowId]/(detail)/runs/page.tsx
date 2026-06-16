import { WorkflowRunsPage } from "@/modules/workflows/pages/workflow-runs-page";

const WorkflowRuns = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; workflowId: string }> }>
) => {
  const params = await props.params;

  return <WorkflowRunsPage workspaceId={params.workspaceId} workflowId={params.workflowId} />;
};

export default WorkflowRuns;
