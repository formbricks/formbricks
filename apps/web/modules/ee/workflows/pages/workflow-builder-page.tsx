"use client";

import { useSetAtom } from "jotai";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { WorkflowCanvas } from "@/modules/ee/workflows/components/canvas/workflow-canvas";
import { WorkflowInspectorPanel } from "@/modules/ee/workflows/components/inspector/workflow-inspector-panel";
import { WorkflowEmailAuthoringProvider } from "@/modules/ee/workflows/components/workflow-email-authoring-context";
import { useReconcileTriggerEndingCards } from "@/modules/ee/workflows/hooks/use-reconcile-trigger-ending-cards";
import { useWorkflowBuilder } from "@/modules/ee/workflows/hooks/use-workflow-builder";
import { useWorkflowNodeUrlSync } from "@/modules/ee/workflows/hooks/use-workflow-node-url-sync";
import { resolveBoundTriggerSurvey } from "@/modules/ee/workflows/lib/bound-survey";
import { useWorkflowSurveyOptions } from "@/modules/ee/workflows/list/hooks/use-trigger-survey-picker";
import { WorkflowBuilderBodyLoading } from "@/modules/ee/workflows/loading";
import { hasBoundTriggerSurveyAtom } from "@/modules/ee/workflows/state/editor";
import type { TWorkflowEmailAuthoringContext } from "@/modules/ee/workflows/types/email-authoring-context";

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
  const surveyOptionsQuery = useWorkflowSurveyOptions(workspaceId);

  // This page owns pushing the "does the trigger's survey resolve" fact into the shared atom the
  // validity + canvas checks read. Two sources, so the flag flips the moment a survey is picked:
  // the server-resolved authoring context (authoritative — catches deleted surveys) still lags a
  // save + refresh behind the draft, so membership in the workspace survey list (the same query
  // the trigger's picker offers choices from) vouches for a just-picked id immediately.
  // Keyed on the inputs (not the computed boolean): hydration resets the atom to its optimistic
  // default, and a boolean-keyed effect would skip re-syncing when the computed value happens to
  // match its pre-hydration result.
  const definition = builder.definition;
  const surveyOptions = surveyOptionsQuery.options;
  useEffect(() => {
    const triggerSurveyId = definition?.trigger?.config.surveyId ?? null;
    const isBound =
      Boolean(resolveBoundTriggerSurvey(emailAuthoringContext, definition)) ||
      (triggerSurveyId !== null && surveyOptions.some((option) => option.id === triggerSurveyId));
    setHasBoundTriggerSurvey(isBound);
  }, [emailAuthoringContext, definition, surveyOptions, setHasBoundTriggerSurvey]);

  // Prune trigger ending-card ids whose endings were deleted. On the page (not the trigger form) so
  // the canvas summary and enable gate stay correct without opening the inspector.
  useReconcileTriggerEndingCards({ definition, isEditable: builder.canEditDefinition });

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
    // Claims the height the page layout hands down (`min-h-0` so it may shrink below its content
    // rather than push the page taller), and both columns stretch to fill it.
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <WorkflowEmailAuthoringProvider value={emailAuthoringContext}>
        {/* Canvas and inspector share one height, derived from this row rather than computed from
            the viewport. Each owns its own overflow: the canvas clips (it pans), the inspector
            scrolls — so however long a config form runs, the page itself never grows. */}
        <section className="flex min-h-0 flex-1 gap-4">
          <WorkflowCanvas isEditable={builder.canEditDefinition} />
          <WorkflowInspectorPanel isEditingNode={builder.canEditDefinition} />
        </section>
      </WorkflowEmailAuthoringProvider>
    </div>
  );
};
