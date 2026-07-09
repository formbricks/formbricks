"use client";

import { useSetAtom } from "jotai";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { WorkflowCanvas } from "@/modules/workflows/components/canvas/workflow-canvas";
import { WorkflowInspectorPanel } from "@/modules/workflows/components/inspector/workflow-inspector-panel";
import { WorkflowEmailAuthoringProvider } from "@/modules/workflows/components/workflow-email-authoring-context";
import { useWorkflowBuilder } from "@/modules/workflows/hooks/use-workflow-builder";
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
  const hasBoundTriggerSurvey = Boolean(resolveBoundTriggerSurvey(emailAuthoringContext, builder.definition));
  useEffect(() => {
    setHasBoundTriggerSurvey(hasBoundTriggerSurvey);
  }, [hasBoundTriggerSurvey, setHasBoundTriggerSurvey]);

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
          <WorkflowInspectorPanel
            workflowId={workflowId}
            isReadOnly={isReadOnly}
            canEditMetadata={builder.canEditMetadata}
            isEditingNode={builder.canEditDefinition}
          />
        </section>
      </WorkflowEmailAuthoringProvider>
    </div>
  );
};
