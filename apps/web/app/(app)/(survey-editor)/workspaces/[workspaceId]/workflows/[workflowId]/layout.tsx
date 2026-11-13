import type { ReactNode } from "react";
import { getTranslate } from "@/lingodotdev/server";
import { WorkflowEditorFrame } from "@/modules/ee/workflows/components/workflow-editor-frame";
import {
  WorkflowEditorHeader,
  WorkflowEditorPlainHeader,
} from "@/modules/ee/workflows/components/workflow-editor-header";
import { WorkflowEditorProvider } from "@/modules/ee/workflows/components/workflow-editor-provider";
import { WorkflowsUpgradePrompt } from "@/modules/ee/workflows/components/workflows-upgrade-prompt";
import { getWorkflowsRouteAuth } from "@/modules/ee/workflows/lib/auth";

const WorkflowDetailLayout = async (
  props: Readonly<{
    params: Promise<{ workspaceId: string; workflowId: string }>;
    children: ReactNode;
  }>
) => {
  const params = await props.params;
  const { isReadOnly, isWorkflowsEnabled, organizationId } = await getWorkflowsRouteAuth(params.workspaceId);

  if (!isWorkflowsEnabled) {
    // Not entitled: a plain title instead of the editable name and the status menu — those fetch the
    // workflow through the now-403 API and must not render broken states. Both tabs land on this prompt.
    const t = await getTranslate();
    return (
      <WorkflowEditorFrame
        workspaceId={params.workspaceId}
        workflowId={params.workflowId}
        header={<WorkflowEditorPlainHeader workspaceId={params.workspaceId} title={t("common.workflows")} />}>
        <WorkflowsUpgradePrompt organizationId={organizationId} />
      </WorkflowEditorFrame>
    );
  }

  return (
    <WorkflowEditorProvider>
      <WorkflowEditorFrame
        workspaceId={params.workspaceId}
        workflowId={params.workflowId}
        header={
          <WorkflowEditorHeader
            workspaceId={params.workspaceId}
            workflowId={params.workflowId}
            isReadOnly={isReadOnly}
          />
        }>
        {props.children}
      </WorkflowEditorFrame>
    </WorkflowEditorProvider>
  );
};

export default WorkflowDetailLayout;
