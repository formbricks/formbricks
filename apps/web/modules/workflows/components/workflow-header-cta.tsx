"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { ArchiveIcon, ArchiveRestoreIcon, Loader2Icon, PlayIcon, PowerOffIcon, SaveIcon } from "lucide-react";
import { useSelectedLayoutSegment } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
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
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);

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

  const handleArchiveConfirm = async () => {
    await builder.archive();
    setIsArchiveModalOpen(false);
  };

  // Only the edit tab gets the lifecycle controls — the runs tab is read-only.
  if (segment !== null) return null;
  if (!workflow) return null;

  const isArchived = workflow.status === "archived";
  const isActive = workflow.status === "enabled";

  return (
    <div className="flex items-center gap-3">
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
          {/* Archive first — opens a confirmation modal before the destructive transition. The
              spinner lives on the modal's confirm button, so this one only disables (no spinner)
              while another lifecycle action runs. */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsArchiveModalOpen(true)}
            disabled={isReadOnly || builder.isTransitioning || builder.isSaving}>
            <ArchiveIcon />
            {t("common.archive")}
          </Button>
          {/* Save sits second as a secondary action — where users instinctively look for it. The
              leading Save icon turns into the spinner while saving (single icon slot, never both),
              so the label never shifts. */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleSave}
            disabled={!builder.canEditMetadata || builder.isTransitioning || builder.isSaving}
            className="min-w-[6rem] justify-center">
            {builder.isSaving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
            {t("common.save")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleActiveChange}
            disabled={isReadOnly || builder.isTransitioning || builder.isSaving}
            className="min-w-[6rem] justify-center">
            {builder.isTransitioning ? (
              <Loader2Icon className="animate-spin" />
            ) : isActive ? (
              <PowerOffIcon />
            ) : (
              <PlayIcon />
            )}
            {isActive ? t("common.disable") : t("common.enable")}
          </Button>
        </>
      )}

      <ConfirmationModal
        open={isArchiveModalOpen}
        setOpen={setIsArchiveModalOpen}
        title={t("workspace.workflows.archive_confirm_title")}
        body={t("workspace.workflows.archive_confirm_body")}
        buttonText={t("common.archive")}
        buttonVariant="destructive"
        buttonLoading={builder.isTransitioning}
        isButtonDisabled={isReadOnly || builder.isTransitioning}
        onConfirm={handleArchiveConfirm}
        Icon={ArchiveIcon}
      />
    </div>
  );
};
