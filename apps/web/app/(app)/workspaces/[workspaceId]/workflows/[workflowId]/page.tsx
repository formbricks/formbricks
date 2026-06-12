import { getTranslate } from "@/lingodotdev/server";
import { getWorkflowsRouteAuth } from "@/modules/workflows/lib/auth";
import { WorkflowBuilderPage } from "@/modules/workflows/pages/workflow-builder-page";

const WorkflowPage = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; workflowId: string }> }>
) => {
  const params = await props.params;
  const t = await getTranslate();
  const { isReadOnly } = await getWorkflowsRouteAuth(params.workspaceId);

  return (
    <WorkflowBuilderPage
      workspaceId={params.workspaceId}
      workflowId={params.workflowId}
      isReadOnly={isReadOnly}
      t={t}
    />
  );
};

export default WorkflowPage;
