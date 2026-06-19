"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { useSelectedLayoutSegment } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { useWorkflowBuilder } from "@/modules/workflows/hooks/use-workflow-builder";
import { getWorkflowStatusBadge } from "@/modules/workflows/lib/display";
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

  // Only the edit tab gets the lifecycle controls — the runs tab is read-only.
  if (segment !== null) return null;
  if (!workflow) return null;

  const statusBadge = getWorkflowStatusBadge(workflow.status, t);
  const isArchived = workflow.status === "archived";

  return (
    <div className="flex items-center gap-2">
      <Badge text={statusBadge.label} type={statusBadge.type} size="normal" />
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
            disabled={isReadOnly || builder.isTransitioning}>
            <ArchiveIcon />
            {t("common.archive")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            loading={builder.isSaving}
            disabled={!builder.canEditMetadata}>
            {t("common.save")}
          </Button>
        </>
      )}
    </div>
  );
};
