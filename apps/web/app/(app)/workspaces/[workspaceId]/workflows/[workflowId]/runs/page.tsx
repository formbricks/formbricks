import { getTranslate } from "@/lingodotdev/server";
import { getWorkflowsRouteAuth } from "@/modules/workflows/lib/auth";
import { WorkflowRunsPage } from "@/modules/workflows/pages/workflow-runs-page";

const WorkflowRuns = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; workflowId: string }> }>
) => {
  const params = await props.params;
  const t = await getTranslate();
  await getWorkflowsRouteAuth(params.workspaceId);

  return <WorkflowRunsPage workspaceId={params.workspaceId} workflowId={params.workflowId} t={t} />;
};

export default WorkflowRuns;
