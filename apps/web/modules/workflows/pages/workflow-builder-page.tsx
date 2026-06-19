"use client";

import { useTranslation } from "react-i18next";
import { WorkflowCanvas } from "@/modules/workflows/components/canvas/workflow-canvas";
import { WorkflowInspectorPanel } from "@/modules/workflows/components/inspector/workflow-inspector-panel";
import { useWorkflowBuilder } from "@/modules/workflows/hooks/use-workflow-builder";
import { WorkflowBuilderBodyLoading } from "@/modules/workflows/loading";

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
      <section className="flex min-h-[calc(100vh-220px)] gap-4">
        <WorkflowCanvas isEditable={builder.canEditDefinition} />
        <WorkflowInspectorPanel
          canEditDefinition={builder.canEditDefinition}
          canEditMetadata={builder.canEditMetadata}
          isEditingNode={builder.canEditDefinition}
          onSaveNode={builder.save}
          isSavingNode={builder.isSaving}
        />
      </section>
    </div>
  );
};
