"use client";

import { useAtomValue, useSetAtom } from "jotai";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ChevronDownIcon,
  CirclePauseIcon,
  CirclePlayIcon,
  FlaskConicalIcon,
  TrashIcon,
  Undo2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { usePublishedWorkflowVersion } from "@/modules/ee/workflows/hooks/use-published-workflow-version";
import { useWorkflowBuilder } from "@/modules/ee/workflows/hooks/use-workflow-builder";
import { summarizeValidationProblems, trackWorkflowEvent } from "@/modules/ee/workflows/lib/analytics";
import { WORKFLOW_CLIENT_EVENTS } from "@/modules/ee/workflows/lib/analytics-events";
import { deleteWorkflow } from "@/modules/ee/workflows/lib/api-client";
import { getWorkflowStatusBadge } from "@/modules/ee/workflows/lib/display";
import {
  setWorkflowDefinitionAtom,
  workflowAtom,
  workflowDefinitionAtom,
  workflowValidationProblemsAtom,
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
  /** Shows or hides the Runs view's test form (from the Editor, opens Runs on it); absent: disabled. */
  onTest?: () => void;
  /** The test form shows in the Runs view: the button reads as pressed. */
  isTestActive?: boolean;
}

export const WorkflowHeaderCta = ({
  workflowId,
  isReadOnly,
  onTest,
  isTestActive = false,
}: Readonly<WorkflowHeaderCtaProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const workflow = useAtomValue(workflowAtom);
  const validity = useAtomValue(workflowValidityAtom);
  const validationProblems = useAtomValue(workflowValidationProblemsAtom);
  const builder = useWorkflowBuilder({ workflowId, isReadOnly, loadOnMount: false });
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const definition = useAtomValue(workflowDefinitionAtom);
  const setDefinition = useSetAtom(setWorkflowDefinitionAtom);
  // "Discard changes" goes back to the latest enabled version, so it only exists for a draft or
  // disabled workflow that has been enabled before. A workflow never enabled has nothing to go back to.
  const canDiscard =
    !isReadOnly && workflow !== null && workflow.status !== "enabled" && workflow.status !== "archived";
  const publishedVersion = usePublishedWorkflowVersion({ workflowId, enabled: canDiscard });

  if (!workflow) return null;
  // Test and the status menu sit in the header on both tabs (Editor and Runs). The autosave pill
  // lives in the tab row (workflow-editor-toolbar), which also follows a save failure to the runs tab.

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

  // Analytics: a user opening the status menu of a draft whose Enable is greyed out is the closest
  // thing to "tried to enable and could not", and the problem codes say what stopped them.
  const published = canDiscard ? (publishedVersion.data ?? null) : null;
  const hasChangesSincePublished =
    published !== null && JSON.stringify(published.definition) !== JSON.stringify(definition);

  // Loads the enabled version into the draft. It then saves like any edit, and Undo brings the
  // discarded changes back.
  const handleDiscardConfirm = () => {
    if (published) setDefinition(published.definition);
    setIsDiscardModalOpen(false);
    toast.success(t("workspace.workflows.discard_changes_done"));
  };

  const handleStatusMenuOpenChange = (open: boolean) => {
    if (open && canDiscard) void publishedVersion.refetch();
    if (open && !isArchived && !isActive && !validity.isReady) {
      trackWorkflowEvent(
        WORKFLOW_CLIENT_EVENTS.enableBlocked,
        summarizeValidationProblems(validationProblems)
      );
    }
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
    <div className="flex shrink-0 items-center gap-3">
      {/* Lifecycle as a status dropdown (same shape as the surveys list "New survey" menu): the
          button reads the current state, the menu holds the transitions available from it. */}
      {/* Secondary on purpose: the status menu stays the one primary control (ED8). Test shows or
            hides the Runs view's test form and runs nothing itself; read-only members may not test. */}
      <Button
        variant="secondary"
        size="sm"
        className={cn(isTestActive && "bg-slate-200 hover:bg-slate-200")}
        aria-pressed={isTestActive}
        disabled={!onTest || isReadOnly || isDeleting}
        onClick={onTest}>
        <FlaskConicalIcon />
        {t("workspace.workflows.test")}
      </Button>
      <DropdownMenu onOpenChange={handleStatusMenuOpenChange}>
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
                {published ? (
                  <DropdownMenuItem
                    icon={<Undo2Icon className="size-4" />}
                    disabled={!hasChangesSincePublished}
                    onSelect={() => setIsDiscardModalOpen(true)}>
                    {t("workspace.workflows.discard_changes")}
                  </DropdownMenuItem>
                ) : null}
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
      <ConfirmationModal
        open={isDiscardModalOpen}
        setOpen={setIsDiscardModalOpen}
        title={t("workspace.workflows.discard_changes_title")}
        // The dialog's default subtitle says the action can't be undone; this one can.
        description={t("workspace.workflows.discard_changes_undoable")}
        body={t("workspace.workflows.discard_changes_body", { version: published?.version ?? 0 })}
        buttonText={t("workspace.workflows.discard_changes")}
        buttonVariant="destructive"
        isButtonDisabled={!published}
        onConfirm={handleDiscardConfirm}
        Icon={Undo2Icon}
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
