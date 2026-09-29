import { getWorkflowsRouteAuth } from "@/modules/ee/workflows/lib/auth";
import { getWorkflowEmailAuthoringContext } from "@/modules/ee/workflows/lib/email-authoring-context";
import { WorkflowBuilderPage } from "@/modules/ee/workflows/pages/workflow-builder-page";
import { getSurveyVisibilityUiGate } from "@/modules/survey/visibility/lib/gate";

const WorkflowPage = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; workflowId: string }> }>
) => {
  const params = await props.params;
  const { isReadOnly, isWorkflowsEnabled, organizationId } = await getWorkflowsRouteAuth(params.workspaceId);

  // Pages render in parallel with the gating layout; skip the server-side context resolution and
  // contribute nothing when not entitled so the builder never mounts against the now-403 API.
  if (!isWorkflowsEnabled) {
    return null;
  }

  // Resolve the bound survey + team/sender context server-side so the send_email inspector renders
  // Follow-Ups-parity controls (recall body, recipient options) from fully-formed props.
  const [emailAuthoringContext, surveyVisibilityEnabled] = await Promise.all([
    getWorkflowEmailAuthoringContext({
      workflowId: params.workflowId,
      workspaceId: params.workspaceId,
    }),
    getSurveyVisibilityUiGate(organizationId),
  ]);

  return (
    <WorkflowBuilderPage
      workspaceId={params.workspaceId}
      workflowId={params.workflowId}
      isReadOnly={isReadOnly}
      emailAuthoringContext={emailAuthoringContext}
      surveyVisibilityEnabled={surveyVisibilityEnabled}
    />
  );
};

export default WorkflowPage;
