"use client";

import { useTranslation } from "react-i18next";
import { WorkflowCanvas } from "@/modules/workflows/components/canvas/workflow-canvas";
import { WorkflowInspectorPanel } from "@/modules/workflows/components/inspector/workflow-inspector-panel";
import { WorkflowEmailAuthoringProvider } from "@/modules/workflows/components/workflow-email-authoring-context";
import { useWorkflowBuilder } from "@/modules/workflows/hooks/use-workflow-builder";
import { WorkflowBuilderBodyLoading } from "@/modules/workflows/loading";
import type { TWorkflowEmailAuthoringContext } from "@/modules/workflows/types/email-authoring-context";

interface WorkflowBuilderPageProps {
  workspaceId: string;
  workflowId: string;
  isReadOnly: boolean;
  emailAuthoringContext: TWorkflowEmailAuthoringContext;
}

export const WorkflowBuilderPage = ({
  workspaceId,
  workflowId,
  isReadOnly,
  emailAuthoringContext,
}: Readonly<WorkflowBuilderPageProps>) => {
  const { t } = useTranslation();
  const builder = useWorkflowBuilder({ workspaceId, workflowId, isReadOnly });

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

  return (
    <div className="flex flex-col gap-4">
      {/* The provider wraps the canvas too: node validity (red border) needs to know whether the
          trigger's survey resolves, which only the server-resolved authoring context can tell. */}
      <WorkflowEmailAuthoringProvider value={emailAuthoringContext}>
        <section className="flex min-h-[calc(100vh-220px)] gap-4">
          <WorkflowCanvas isEditable={builder.canEditDefinition} isReadOnly={isReadOnly} />
          <WorkflowInspectorPanel
            workflowId={workflowId}
            isReadOnly={isReadOnly}
            canEditMetadata={builder.canEditMetadata}
            isEditingNode={builder.canEditDefinition}
            onSaveNode={builder.save}
            isSavingNode={builder.isSaving}
          />
        </section>
      </WorkflowEmailAuthoringProvider>
    </div>
  );
};
