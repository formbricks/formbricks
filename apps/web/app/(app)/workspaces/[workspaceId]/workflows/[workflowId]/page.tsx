import { WorkflowBuilderPage } from "@/modules/workflows/pages/workflow-builder-page";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

const WorkflowPage = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; workflowId: string }> }>
) => {
  const { workspaceId, workflowId } = await props.params;
  const { isReadOnly } = await getWorkspaceAuth(workspaceId);

  return <WorkflowBuilderPage workspaceId={workspaceId} workflowId={workflowId} isReadOnly={isReadOnly} />;
};

export default WorkflowPage;
