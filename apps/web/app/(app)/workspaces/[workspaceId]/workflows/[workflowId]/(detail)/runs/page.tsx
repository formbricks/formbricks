import { getPlaceholderWorkflow, getPlaceholderWorkflowRuns } from "@/modules/workflows/lib/placeholder-data";
import { WorkflowRunsPage } from "@/modules/workflows/pages/workflow-runs-page";

const WorkflowRuns = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; workflowId: string }> }>
) => {
  const params = await props.params;
  const runs = getPlaceholderWorkflowRuns(params.workflowId).map((run) => ({
    ...run,
    workflowName: getPlaceholderWorkflow(run.workflowId)?.name ?? run.workflowId,
  }));

  return <WorkflowRunsPage runs={runs} />;
};

export default WorkflowRuns;
