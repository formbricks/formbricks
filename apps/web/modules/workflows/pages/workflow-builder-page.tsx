"use client";

import { WorkflowCanvas } from "@/modules/workflows/components/canvas/workflow-canvas";
import { WorkflowInspectorPanel } from "@/modules/workflows/components/inspector/workflow-inspector-panel";
import { WorkflowNodeConfigModal } from "@/modules/workflows/components/inspector/workflow-node-config-modal";
import { useWorkflowBuilder } from "@/modules/workflows/hooks/use-workflow-builder";
import { WorkflowBuilderBodyLoading } from "@/modules/workflows/loading";

interface WorkflowBuilderPageProps {
  workspaceId: string;
  workflowId: string;
  isReadOnly: boolean;
}

export const WorkflowBuilderPage = ({ workflowId, isReadOnly }: Readonly<WorkflowBuilderPageProps>) => {
  const builder = useWorkflowBuilder({ workflowId, isReadOnly });

  if (builder.isLoading) {
    return <WorkflowBuilderBodyLoading />;
  }

  if (!builder.workflow) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        {builder.loadError ?? "Failed to load workflow."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-slate-100 p-4">
      <section className="flex min-h-[calc(100vh-220px)] gap-4">
        <WorkflowCanvas isEditable={builder.canEdit} />
        <WorkflowInspectorPanel
          workflowId={workflowId}
          isReadOnly={isReadOnly}
          isEditable={builder.canEdit}
        />
      </section>
      <WorkflowNodeConfigModal isEditable={builder.canEdit} />
    </div>
  );
};
