"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
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

  const handleActiveChange = (checked: boolean) => {
    if (checked) {
      builder.enable();
    } else {
      builder.disable();
    }
  };

  // Only the edit tab gets the lifecycle controls — the runs tab is read-only.
  if (segment !== null) return null;
  if (!workflow) return null;

  const isArchived = workflow.status === "archived";
  const isActive = workflow.status === "enabled";

  return (
    <div className="flex items-center gap-3">
      {!isArchived && (
        <div className="flex items-center gap-2">
          <Switch
            id="workflow-header-active"
            checked={isActive}
            disabled={isReadOnly || builder.isTransitioning || builder.isSaving}
            onCheckedChange={handleActiveChange}
          />
          <label htmlFor="workflow-header-active" className="text-sm font-medium text-slate-700">
            {isActive ? t("workspace.workflows.active") : t("workspace.workflows.inactive")}
          </label>
        </div>
      )}
      {isArchived ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={builder.unarchive}
          loading={builder.isTransitioning}
          disabled={isReadOnly || builder.isTransitioning}>
          <ArchiveRestoreIcon />
          {t("common.unarchive")}
        </Button>
      ) : (
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={builder.archive}
            loading={builder.isTransitioning}
            disabled={isReadOnly || builder.isTransitioning || builder.isSaving}>
            <ArchiveIcon />
            {t("common.archive")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            loading={builder.isSaving}
            disabled={!builder.canEditMetadata || builder.isTransitioning}>
            {t("common.save")}
          </Button>
        </>
      )}
    </div>
  );
};
