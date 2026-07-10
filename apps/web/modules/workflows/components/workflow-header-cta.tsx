"use client";

import { useAtomValue } from "jotai";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ChevronDownIcon,
  CirclePauseIcon,
  CirclePlayIcon,
  TrashIcon,
} from "lucide-react";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { WorkflowAutoSaveIndicator } from "@/modules/workflows/components/workflow-auto-save-indicator";
import { useWorkflowBuilder } from "@/modules/workflows/hooks/use-workflow-builder";
import { deleteWorkflow } from "@/modules/workflows/lib/api-client";
import { getWorkflowStatusBadge } from "@/modules/workflows/lib/display";
import { workflowAtom, workflowValidityAtom } from "@/modules/workflows/state/editor";

interface WorkflowHeaderCtaProps {
  workflowId: string;
  isReadOnly: boolean;
}

export const WorkflowHeaderCta = ({ workflowId, isReadOnly }: Readonly<WorkflowHeaderCtaProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const workflow = useAtomValue(workflowAtom);
  const validity = useAtomValue(workflowValidityAtom);
  const builder = useWorkflowBuilder({ workflowId, isReadOnly, loadOnMount: false });
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Only the edit tab gets the lifecycle controls — the runs tab is read-only.
  if (segment !== null) return null;
  if (!workflow) return null;

  const isArchived = workflow.status === "archived";
  const isActive = workflow.status === "enabled";
  const isBusy = builder.isTransitioning || builder.isSaving || isDeleting;

  const handleArchiveConfirm = async () => {
    await builder.archive();
    setIsArchiveModalOpen(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteWorkflow(workflow.id);
      toast.success(t("workspace.workflows.delete_success"));
      router.push(`/workspaces/${workflow.workspaceId}/workflows`);
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.delete_failed")));
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {builder.canEditMetadata ? <WorkflowAutoSaveIndicator /> : null}
      {/* Lifecycle as a status dropdown (same shape as the surveys list "New survey" menu): the
          button reads the current state, the menu holds the transitions available from it. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" loading={builder.isTransitioning} disabled={isReadOnly || isBusy}>
            {getWorkflowStatusBadge(workflow.status, t).label}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {isArchived ? (
            <>
              <DropdownMenuItem
                icon={<ArchiveRestoreIcon className="size-4" />}
                onSelect={() => void builder.unarchive()}>
                {t("common.unarchive")}
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<TrashIcon className="size-4" />}
                className="text-red-600 focus:text-red-600"
                onSelect={() => setIsDeleteDialogOpen(true)}>
                {t("common.delete")}
              </DropdownMenuItem>
            </>
          ) : (
            <>
              {isActive ? (
                <DropdownMenuItem
                  icon={<CirclePauseIcon className="size-4" />}
                  onSelect={() => void builder.disable()}>
                  {t("common.disable")}
                </DropdownMenuItem>
              ) : (
                // Enabling requires a workflow the server would accept; the readiness hint next
                // to the Save button says what is still missing.
                <DropdownMenuItem
                  icon={<CirclePlayIcon className="size-4" />}
                  disabled={!validity.isReady}
                  onSelect={() => void builder.enable()}>
                  {t("common.enable")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                icon={<ArchiveIcon className="size-4" />}
                onSelect={() => setIsArchiveModalOpen(true)}>
                {t("common.archive")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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
      <DeleteDialog
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        deleteWhat={workflow.name}
        onDelete={() => void handleDelete()}
        isDeleting={isDeleting}
        text={t("workspace.workflows.delete_workflow_confirmation", { name: workflow.name })}
      />
    </div>
  );
};
