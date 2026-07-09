"use client";

import { useAtomValue } from "jotai";
import { Loader2Icon } from "lucide-react";
import { useSelectedLayoutSegment } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Switch } from "@/modules/ui/components/switch";
import { useWorkflowBuilder } from "@/modules/workflows/hooks/use-workflow-builder";
import { workflowAtom } from "@/modules/workflows/state/editor";

interface WorkflowHeaderCtaProps {
  workflowId: string;
  isReadOnly: boolean;
}

export const WorkflowHeaderCta = ({ workflowId, isReadOnly }: Readonly<WorkflowHeaderCtaProps>) => {
  const { t } = useTranslation();
  const segment = useSelectedLayoutSegment();
  const workflow = useAtomValue(workflowAtom);
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
      {/* Mirrors the survey editor: drafts say "Save as draft" so the label carries the status
          the save keeps you in. Archive/Unarchive live in the Settings panel. */}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => builder.save()}
        loading={builder.isSaving}
        disabled={!builder.canEditMetadata || builder.isTransitioning || builder.isSaving}>
        {workflow.status === "draft" ? t("common.save_as_draft") : t("common.save")}
      </Button>
      {/* Lifecycle control as a toggle: the switch position communicates the current state
          (on = running) instead of an Enable/Disable action label the user has to invert.
          The shell matches the sibling h-8 buttons so it reads as part of the button row. */}
      <label
        htmlFor="workflow-enabled-toggle"
        className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-primary/5 bg-secondary px-3 text-xs font-medium text-secondary-foreground has-[button:disabled]:cursor-not-allowed has-[button:disabled]:opacity-50">
        <Switch
          id="workflow-enabled-toggle"
          checked={isActive}
          disabled={isReadOnly || isArchived || builder.isTransitioning || builder.isSaving}
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
