"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { useSelectedLayoutSegment } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Switch } from "@/modules/ui/components/switch";
import { useWorkflowBuilder } from "@/modules/workflows/hooks/use-workflow-builder";
import { isCanvasLockedAtom, workflowAtom } from "@/modules/workflows/state/editor";

interface WorkflowHeaderCtaProps {
  workflowId: string;
  isReadOnly: boolean;
}

export const WorkflowHeaderCta = ({ workflowId, isReadOnly }: Readonly<WorkflowHeaderCtaProps>) => {
  const { t } = useTranslation();
  const segment = useSelectedLayoutSegment();
  const workflow = useAtomValue(workflowAtom);
  const setCanvasLocked = useSetAtom(isCanvasLockedAtom);
  const builder = useWorkflowBuilder({ workflowId, isReadOnly, loadOnMount: false });

  // Header Save is the "end this editing session" action — persist, then re-lock the canvas so
  // the user explicitly opts back into edit mode. Per-node modal Save just persists.
  const handleSave = async () => {
    await builder.save();
    setCanvasLocked(true);
  };

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
      {/* The trailing Save icon turns into the spinner while saving (single icon slot, never
          both), so the label never shifts. Archive/Unarchive live in the Settings panel. */}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleSave}
        disabled={!builder.canEditMetadata || builder.isTransitioning || builder.isSaving}
        className="min-w-[6rem] justify-center">
        {t("common.save")}
        {builder.isSaving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
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
