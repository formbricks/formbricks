import { getTranslate } from "@/lingodotdev/server";
import { getWorkflowsRouteAuth } from "@/modules/workflows/lib/auth";
import { WorkflowsListPage } from "@/modules/workflows/pages/workflows-list-page";

const WorkflowsPage = async (props: Readonly<{ params: Promise<{ workspaceId: string }> }>) => {
  const params = await props.params;
  const t = await getTranslate();
  const { isReadOnly } = await getWorkflowsRouteAuth(params.workspaceId);

  return <WorkflowsListPage workspaceId={params.workspaceId} isReadOnly={isReadOnly} t={t} />;
};

export default WorkflowsPage;
