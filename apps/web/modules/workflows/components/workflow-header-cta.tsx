"use client";

import { useAtomValue } from "jotai";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ChevronDownIcon,
  CircleDashedIcon,
  CirclePauseIcon,
  CirclePlayIcon,
  TrashIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
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
import { getWorkflowReadinessHint } from "@/modules/workflows/lib/workflow-readiness";
import { workflowAtom, workflowDefinitionAtom, workflowValidityAtom } from "@/modules/workflows/state/editor";

interface WorkflowHeaderCtaProps {
  workflowId: string;
  isReadOnly: boolean;
}

export const WorkflowHeaderCta = ({ workflowId, isReadOnly }: Readonly<WorkflowHeaderCtaProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const workflow = useAtomValue(workflowAtom);
  const definition = useAtomValue(workflowDefinitionAtom);
  const validity = useAtomValue(workflowValidityAtom);
  const builder = useWorkflowBuilder({ workflowId, isReadOnly, loadOnMount: false });
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Only the edit tab gets the lifecycle controls — the runs tab is read-only.
  if (segment !== null) return null;
  if (!workflow) return null;

  const isArchived = workflow.status === "archived";
  const isDraft = workflow.status === "draft";
  const isActive = workflow.status === "enabled";
  const isBusy = builder.isTransitioning || builder.isSaving || isDeleting;

  const readinessHint = getWorkflowReadinessHint(definition, validity);
  // Inline literal t() calls so the translation-key scanner detects every key.
  const readinessHintLabels: Record<NonNullable<typeof readinessHint>, string> = {
    add_trigger: t("workspace.workflows.readiness_add_trigger"),
    complete_trigger: t("workspace.workflows.readiness_complete_trigger"),
    add_action: t("workspace.workflows.readiness_add_action"),
    complete_action: t("workspace.workflows.readiness_complete_action"),
    name_missing: t("workspace.workflows.readiness_name_missing"),
    not_executable: t("workspace.workflows.test_problems_title"),
  };

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
      {/* One concrete next step, resolved from the live editor state. Drafts render it as quiet
          setup guidance (an unfinished draft has a to-do, not a problem); a previously-live
          workflow that can no longer run gets the red warning treatment. */}
      {readinessHint && !isArchived ? (
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
      ) : null}
      {builder.canEditMetadata ? <WorkflowAutoSaveIndicator /> : null}
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
        disabled={!builder.canEditMetadata || !builder.isDirty || isBusy}>
        {isDraft ? t("common.save_as_draft") : t("common.save")}
        {builder.isDirty && !builder.isSaving ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-white bg-amber-400"
          />
        ) : null}
      </Button>
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
