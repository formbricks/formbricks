"use client";

import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { WorkflowCanvas } from "@/modules/workflows/components/canvas/workflow-canvas";
import { WorkflowInspectorPanel } from "@/modules/workflows/components/inspector/workflow-inspector-panel";
import { WorkflowNodeConfigModal } from "@/modules/workflows/components/inspector/workflow-node-config-modal";
import { useWorkflowBuilder } from "@/modules/workflows/hooks/use-workflow-builder";
import { WorkflowBuilderBodyLoading } from "@/modules/workflows/loading";
import { isCanvasLockedAtom } from "@/modules/workflows/state/editor";

interface WorkflowBuilderPageProps {
  workspaceId: string;
  workflowId: string;
  isReadOnly: boolean;
}

export const WorkflowBuilderPage = ({
  workspaceId,
  workflowId,
  isReadOnly,
}: Readonly<WorkflowBuilderPageProps>) => {
  const { t } = useTranslation();
  const builder = useWorkflowBuilder({ workspaceId, workflowId, isReadOnly });
  const isLocked = useAtomValue(isCanvasLockedAtom);

  if (builder.isLoading) {
    return <WorkflowBuilderBodyLoading />;
  }

  if (!builder.workflow) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        {builder.loadError ?? t("workspace.workflows.load_failed")}
      </div>
    );
  }

  // Modal inputs honour the canvas lock — when locked, the user can still open a node and
  // inspect its configuration, but every field is read-only.
  const canEditNode = builder.canEditDefinition && !isLocked;

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-slate-100 p-4">
      <section className="flex min-h-[calc(100vh-220px)] gap-4">
        <WorkflowCanvas isEditable={builder.canEditDefinition} />
        <WorkflowInspectorPanel
          workflowId={workflowId}
          isReadOnly={isReadOnly}
          canEditDefinition={builder.canEditDefinition}
          canEditMetadata={builder.canEditMetadata}
        />
      </section>
      <WorkflowNodeConfigModal isEditable={canEditNode} onSave={builder.save} isSaving={builder.isSaving} />
    </div>
  );
};
