import { getWorkflowsRouteAuth } from "@/modules/workflows/lib/auth";
import { getWorkflowEmailAuthoringContext } from "@/modules/workflows/lib/email-authoring-context";
import { WorkflowBuilderPage } from "@/modules/workflows/pages/workflow-builder-page";

const WorkflowPage = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; workflowId: string }> }>
) => {
  const params = await props.params;
  const { isReadOnly } = await getWorkflowsRouteAuth(params.workspaceId);

  // Resolve the bound survey + team/sender context server-side so the send_email inspector renders
  // Follow-Ups-parity controls (recall body, recipient options) from fully-formed props.
  const emailAuthoringContext = await getWorkflowEmailAuthoringContext({
    workflowId: params.workflowId,
    workspaceId: params.workspaceId,
  });

  return (
    <WorkflowBuilderPage
      workspaceId={params.workspaceId}
      workflowId={params.workflowId}
      isReadOnly={isReadOnly}
      emailAuthoringContext={emailAuthoringContext}
    />
  );
};

export default WorkflowPage;
