"use client";

import { useAtomValue } from "jotai";
import { Loader2Icon, TriangleAlertIcon } from "lucide-react";
import { useSelectedLayoutSegment } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Switch } from "@/modules/ui/components/switch";
import { useWorkflowBuilder } from "@/modules/workflows/hooks/use-workflow-builder";
import { workflowAtom, workflowValidityAtom } from "@/modules/workflows/state/editor";

interface WorkflowHeaderCtaProps {
  workflowId: string;
  isReadOnly: boolean;
}

export const WorkflowHeaderCta = ({ workflowId, isReadOnly }: Readonly<WorkflowHeaderCtaProps>) => {
  const { t } = useTranslation();
  const segment = useSelectedLayoutSegment();
  const workflow = useAtomValue(workflowAtom);
  const validity = useAtomValue(workflowValidityAtom);
  const builder = useWorkflowBuilder({ workflowId, isReadOnly, loadOnMount: false });

  const handleActiveChange = () => {
    if (isActive) {
      builder.disable();
    } else {
      builder.enable();
    }
  };

  // Only the edit tab gets the lifecycle controls — the runs tab is read-only.
  if (segment !== null) return null;
  if (!workflow) return null;

  const isArchived = workflow.status === "archived";
  const isActive = workflow.status === "enabled";

  return (
    <div className="flex items-center gap-3">
      {/* Validity is computed live from the editor state (workflowValidityAtom mirrors the
          server's enable/test pre-flight), so the author sees "not ready" while building,
          not after a failed enable. Amber: an unfinished draft is guidance, not an error. */}
      {!isArchived && !validity.isReady ? (
        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
          <TriangleAlertIcon className="size-4" aria-hidden="true" />
          {t("workspace.workflows.test_problems_title")}
        </span>
      ) : null}
      {/* Edits autosave; the button stays as the explicit "persist now" escape hatch and doubles
          as the saved-state signal: enabled with a dot while something is unsaved, disabled once
          everything is persisted. */}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="relative"
        onClick={() => builder.save()}
        loading={builder.isSaving}
        disabled={
          !builder.canEditMetadata || !builder.isDirty || builder.isTransitioning || builder.isSaving
        }>
        {workflow.status === "draft" ? t("common.save_as_draft") : t("common.save")}
        {builder.isDirty && !builder.isSaving ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-white bg-amber-400"
          />
        ) : null}
      </Button>
      {/* Lifecycle control as a toggle: the switch position communicates the current state
          (on = running) instead of an Enable/Disable action label the user has to invert.
          The shell matches the sibling h-8 buttons so it reads as part of the button row.
          Enabling is gated on live validity — the server would reject a non-executable
          definition anyway; disabling an active workflow is always allowed. */}
      <label
        htmlFor="workflow-enabled-toggle"
        className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-primary/5 bg-secondary px-3 text-xs font-medium text-secondary-foreground has-[button:disabled]:cursor-not-allowed has-[button:disabled]:opacity-50">
        <Switch
          id="workflow-enabled-toggle"
          checked={isActive}
          disabled={
            isReadOnly ||
            isArchived ||
            builder.isTransitioning ||
            builder.isSaving ||
            (!isActive && !validity.isReady)
          }
          onCheckedChange={handleActiveChange}
        />
        {builder.isTransitioning ? (
          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <span>{isActive ? t("common.enabled") : t("common.disabled")}</span>
        )}
      </label>
    </div>
  );
};
