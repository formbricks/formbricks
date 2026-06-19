"use client";

import { useTranslation } from "react-i18next";
import { WorkflowCanvas } from "@/modules/workflows/components/canvas/workflow-canvas";
import { WorkflowInspectorPanel } from "@/modules/workflows/components/inspector/workflow-inspector-panel";
import { WorkflowNodeConfigModal } from "@/modules/workflows/components/inspector/workflow-node-config-modal";
import { useWorkflowBuilder } from "@/modules/workflows/hooks/use-workflow-builder";
import { WorkflowBuilderBodyLoading } from "@/modules/workflows/loading";

interface WorkflowBuilderPageProps {
  workflowId: string;
  isReadOnly: boolean;
}

export const WorkflowBuilderPage = ({ workflowId, isReadOnly }: Readonly<WorkflowBuilderPageProps>) => {
  const { t } = useTranslation();
  const builder = useWorkflowBuilder({ workflowId, isReadOnly });

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
      <WorkflowNodeConfigModal
        isEditable={builder.canEditDefinition}
        onSave={builder.save}
        isSaving={builder.isSaving}
      />
    </div>
  );
};
