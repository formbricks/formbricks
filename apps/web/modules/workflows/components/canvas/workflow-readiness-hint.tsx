"use client";

import { useAtomValue } from "jotai";
import { CircleDashedIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getWorkflowReadinessHint } from "@/modules/workflows/lib/workflow-readiness";
import { workflowAtom, workflowDefinitionAtom, workflowValidityAtom } from "@/modules/workflows/state/editor";

/**
 * One concrete next step, resolved from the live editor state. Drafts render it as quiet
 * setup guidance (an unfinished draft has a to-do, not a problem); a previously-live
 * workflow that can no longer run gets the red warning treatment.
 */
export const WorkflowReadinessHint = () => {
  const { t } = useTranslation();
  const workflow = useAtomValue(workflowAtom);
  const definition = useAtomValue(workflowDefinitionAtom);
  const validity = useAtomValue(workflowValidityAtom);

  if (!workflow || workflow.status === "archived") return null;

  const readinessHint = getWorkflowReadinessHint(definition, validity);
  if (!readinessHint) return null;

  const isDraft = workflow.status === "draft";
  // Inline literal t() calls so the translation-key scanner detects every key.
  const readinessHintLabels: Record<NonNullable<typeof readinessHint>, string> = {
    add_trigger: t("workspace.workflows.readiness_add_trigger"),
    complete_trigger: t("workspace.workflows.readiness_complete_trigger"),
    add_action: t("workspace.workflows.readiness_add_action"),
    complete_action: t("workspace.workflows.readiness_complete_action"),
    name_missing: t("workspace.workflows.readiness_name_missing"),
    not_executable: t("workspace.workflows.test_problems_title"),
  };

  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium",
        isDraft ? "text-slate-500" : "text-red-600"
      )}>
      {isDraft ? (
        <CircleDashedIcon className="size-4" aria-hidden="true" />
      ) : (
        <TriangleAlertIcon className="size-4" aria-hidden="true" />
      )}
      {readinessHintLabels[readinessHint]}
    </span>
  );
};
