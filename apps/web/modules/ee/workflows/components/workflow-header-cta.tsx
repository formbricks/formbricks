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
import { WorkflowAutoSaveIndicator } from "@/modules/ee/workflows/components/workflow-auto-save-indicator";
import { useWorkflowBuilder } from "@/modules/ee/workflows/hooks/use-workflow-builder";
import { deleteWorkflow } from "@/modules/ee/workflows/lib/api-client";
import { getWorkflowStatusBadge } from "@/modules/ee/workflows/lib/display";
import {
  hasWorkflowSaveFailedAtom,
  workflowAtom,
  workflowValidityAtom,
} from "@/modules/ee/workflows/state/editor";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

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
  const hasSaveFailed = useAtomValue(hasWorkflowSaveFailedAtom);
  const builder = useWorkflowBuilder({ workflowId, isReadOnly, loadOnMount: false });
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!workflow) return null;
  // Only the edit tab gets the lifecycle controls — the runs tab is read-only. An unresolved save
  // failure is the exception: the unmount flush can fail during the very tab switch that lands the
  // user here, and the editor is no longer mounted to report it, so the pill has to follow them.
  const isEditTab = segment === null;
  if (!isEditTab && !hasSaveFailed) return null;

  const isArchived = workflow.status === "archived";
  const isActive = workflow.status === "enabled";
  // The status dropdown stays reachable during an autosave (isSaving) so the control never goes dead
  // mid-save with no spinner: transition() already refuses to run while a save is in flight, so
  // writes stay serialized. A pending lifecycle transition or delete still blocks it, as does a
  // read-only member (who also has no menu content to select).
  const isTransitioning = builder.isTransitioning;

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
      {/* The definition is the workflow's real content: while it can't change (enabled, archived,
          or a read-only member) the editor is effectively read-only, so say that instead of
          advertising an autosave that has nothing to act on. An outstanding save failure still wins,
          because name/description autosave keeps running while a workflow is enabled — a failed
          rename would otherwise hide behind a "Read-only" pill. */}
      {builder.canEditDefinition || hasSaveFailed ? (
        <WorkflowAutoSaveIndicator />
      ) : (
        <span className="inline-flex cursor-default items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {t("workspace.workflows.read_only")}
        </span>
      )}
      {/* Lifecycle as a status dropdown (same shape as the surveys list "New survey" menu): the
          button reads the current state, the menu holds the transitions available from it. Edit tab
          only — on the runs tab the pill above is carrying a save failure and nothing else. */}
      {isEditTab && (
        <>
          <DropdownMenu>
            {/* `disabled` must sit on the trigger, not only the child Button: Radix's open guard
                reads the trigger's own prop, so a value passed solely to the Button leaves the menu
                openable (the DOM attribute and the JS guard disagree). Belt-and-suspenders, the
                content is also withheld from read-only members, so a bypassed trigger has nothing
                to select — the list page hides its actions the same way. */}
            <DropdownMenuTrigger asChild disabled={isReadOnly || isTransitioning || isDeleting}>
              <Button
                size="sm"
                loading={builder.isTransitioning}
                disabled={isReadOnly || isTransitioning || isDeleting}>
                {getWorkflowStatusBadge(workflow.status, t).label}
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            {!isReadOnly && (
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
            )}
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
        </>
      )}
    </div>
  );
};
