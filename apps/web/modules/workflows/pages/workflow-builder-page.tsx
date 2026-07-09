"use client";

import { useSetAtom } from "jotai";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { WorkflowCanvas } from "@/modules/workflows/components/canvas/workflow-canvas";
import { WorkflowInspectorPanel } from "@/modules/workflows/components/inspector/workflow-inspector-panel";
import { WorkflowEmailAuthoringProvider } from "@/modules/workflows/components/workflow-email-authoring-context";
import { useWorkflowBuilder } from "@/modules/workflows/hooks/use-workflow-builder";
import { useWorkflowNodeUrlSync } from "@/modules/workflows/hooks/use-workflow-node-url-sync";
import { resolveBoundTriggerSurvey } from "@/modules/workflows/lib/bound-survey";
import { WorkflowBuilderBodyLoading } from "@/modules/workflows/loading";
import { hasBoundTriggerSurveyAtom } from "@/modules/workflows/state/editor";
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
  const setHasBoundTriggerSurvey = useSetAtom(hasBoundTriggerSurveyAtom);

  // Only this page holds the server-resolved authoring context, so it owns pushing the "does the
  // trigger's survey resolve" fact into the shared atom the validity + canvas checks read.
  // Keyed on the inputs (not the computed boolean): hydration resets the atom to its optimistic
  // default, and a boolean-keyed effect would skip re-syncing when the computed value happens to
  // match its pre-hydration result.
  const definition = builder.definition;
  useEffect(() => {
    setHasBoundTriggerSurvey(Boolean(resolveBoundTriggerSurvey(emailAuthoringContext, definition)));
  }, [emailAuthoringContext, definition, setHasBoundTriggerSurvey]);

  // Deep-link the inspected node (?node=…) once the editor is hydrated.
  useWorkflowNodeUrlSync({ isEnabled: Boolean(builder.workflow) });

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
        {/* Canvas and inspector heights are independent: the canvas owns a fixed viewport-based
            height while the inspector grows with its content (the page scrolls past the canvas
            when a config form runs long). No stretch alignment ties one to the other. */}
        <section className="flex items-start gap-4">
          <WorkflowCanvas isEditable={builder.canEditDefinition} isReadOnly={isReadOnly} />
          <WorkflowInspectorPanel isEditingNode={builder.canEditDefinition} />
        </section>
      </WorkflowEmailAuthoringProvider>
    </div>
  );
};
