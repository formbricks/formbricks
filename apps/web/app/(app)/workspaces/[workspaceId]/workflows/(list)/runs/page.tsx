import { getPlaceholderWorkflow, getPlaceholderWorkflowRuns } from "@/modules/workflows/lib/placeholder-data";
import { WorkspaceWorkflowRunsPage } from "@/modules/workflows/pages/workspace-workflow-runs-page";

const WorkflowRunsPage = () => {
  const runs = getPlaceholderWorkflowRuns().map((run) => ({
    ...run,
    workflowName: getPlaceholderWorkflow(run.workflowId)?.name ?? run.workflowId,
  }));

  return <WorkspaceWorkflowRunsPage runs={runs} />;
};

export default WorkflowRunsPage;
