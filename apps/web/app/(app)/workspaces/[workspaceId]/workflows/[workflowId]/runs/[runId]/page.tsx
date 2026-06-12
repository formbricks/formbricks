import { getTranslate } from "@/lingodotdev/server";
import { getWorkflowsRouteAuth } from "@/modules/workflows/lib/auth";
import { WorkflowRunDetailPage } from "@/modules/workflows/pages/workflow-run-detail-page";

const WorkflowRunDetail = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; workflowId: string; runId: string }> }>
) => {
  const params = await props.params;
  const t = await getTranslate();
  await getWorkflowsRouteAuth(params.workspaceId);

  return (
    <WorkflowRunDetailPage
      workspaceId={params.workspaceId}
      workflowId={params.workflowId}
      runId={params.runId}
      t={t}
    />
  );
};

export default WorkflowRunDetail;
