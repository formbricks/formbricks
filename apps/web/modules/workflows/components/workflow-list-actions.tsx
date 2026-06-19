"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CopyIcon,
  MoreVertical,
  SquarePenIcon,
  TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TWorkflowStatus } from "@formbricks/workflows";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { useArchiveWorkflow } from "../hooks/use-archive-workflow";
import { useDeleteWorkflow } from "../hooks/use-delete-workflow";
import { useDuplicateWorkflow } from "../hooks/use-duplicate-workflow";
import { useUnarchiveWorkflow } from "../hooks/use-unarchive-workflow";
import type { workflowKeys } from "../lib/query";

interface WorkflowListActionsProps {
  workflowId: string;
  workflowName: string;
  status: TWorkflowStatus;
  workspaceId: string;
  isReadOnly: boolean;
  queryKey: ReturnType<typeof workflowKeys.list>;
}

export const WorkflowListActions = ({
  workflowId,
  workflowName,
  status,
  workspaceId,
  isReadOnly,
  queryKey,
}: Readonly<WorkflowListActionsProps>) => {
  const { t } = useTranslation();
  const router = useRouter();

  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const archiveWorkflowMutation = useArchiveWorkflow({ queryKey });
  const unarchiveWorkflowMutation = useUnarchiveWorkflow();
  const deleteWorkflowMutation = useDeleteWorkflow({ queryKey });
  const duplicateWorkflowMutation = useDuplicateWorkflow();

  const editHref = `/workspaces/${workspaceId}/workflows/${workflowId}`;

  const handleDuplicate = () => {
    duplicateWorkflowMutation.mutate(
      { workflowId },
      {
        onSuccess: (workflow) => {
          toast.success(t("workspace.workflows.duplicate_success"));
          router.push(`/workspaces/${workspaceId}/workflows/${workflow.id}`);
        },
        onError: (error) => {
          toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.duplicate_failed")));
        },
      }
    );
  };

  const handleArchive = () => {
    archiveWorkflowMutation.mutate(
      { workflowId },
      {
        onSuccess: () => {
          toast.success(t("workspace.workflows.archive_success"));
          setIsArchiveDialogOpen(false);
        },
        onError: (error) => {
          toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.archive_failed")));
        },
      }
    );
  };

  const handleUnarchive = () => {
    unarchiveWorkflowMutation.mutate(
      { workflowId },
      {
        onSuccess: () => {
          toast.success(t("workspace.workflows.unarchive_success"));
        },
        onError: (error) => {
          toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.unarchive_failed")));
        },
      }
    );
  };

  const handleDelete = () => {
    deleteWorkflowMutation.mutate(
      { workflowId },
      {
        onSuccess: () => {
          toast.success(t("workspace.workflows.delete_success"));
          setIsDeleteDialogOpen(false);
        },
        onError: (error) => {
          toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.delete_failed")));
        },
      }
    );
  };

  return (
    <div id={`${workflowId}-workflow-actions`} data-testid="workflow-dropdown-menu">
      <DropdownMenu>
        <DropdownMenuTrigger className="z-10" asChild>
          <button
            type="button"
            data-testid="workflow-dropdown-trigger"
            aria-label={t("common.open_options")}
            className="cursor-pointer rounded-lg border bg-white p-2 hover:bg-slate-50">
            <span className="sr-only">{t("common.open_options")}</span>
            <MoreVertical className="size-4" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="inline-block w-auto min-w-max" align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem
              icon={<SquarePenIcon className="size-4" />}
              onSelect={() => router.push(editHref)}>
              {t("common.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<CopyIcon className="size-4" />}
              disabled={isReadOnly || duplicateWorkflowMutation.isPending}
              onSelect={(event) => {
                event.preventDefault();
                handleDuplicate();
              }}>
              {t("common.duplicate")}
            </DropdownMenuItem>
            {status === "archived" ? (
              <DropdownMenuItem
                icon={<ArchiveRestoreIcon className="size-4" />}
                disabled={isReadOnly || unarchiveWorkflowMutation.isPending}
                onSelect={(event) => {
                  event.preventDefault();
                  handleUnarchive();
                }}>
                {t("workspace.workflows.unarchive")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                icon={<ArchiveIcon className="size-4" />}
                disabled={isReadOnly}
                onSelect={(event) => {
                  event.preventDefault();
                  setIsArchiveDialogOpen(true);
                }}>
                {t("common.archive")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              icon={<TrashIcon className="size-4" />}
              disabled={isReadOnly}
              onSelect={(event) => {
                event.preventDefault();
                setIsDeleteDialogOpen(true);
              }}>
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {!isReadOnly ? (
        <>
          <ConfirmationModal
            open={isArchiveDialogOpen}
            setOpen={setIsArchiveDialogOpen}
            title={t("workspace.workflows.archive_workflow")}
            description={t("workspace.workflows.archive_workflow_description")}
            body={t("workspace.workflows.archive_workflow_confirmation", { name: workflowName })}
            buttonText={t("common.archive")}
            onConfirm={handleArchive}
            buttonLoading={archiveWorkflowMutation.isPending}
            Icon={ArchiveIcon}
          />
          <DeleteDialog
            open={isDeleteDialogOpen}
            setOpen={setIsDeleteDialogOpen}
            deleteWhat={workflowName}
            onDelete={handleDelete}
            isDeleting={deleteWorkflowMutation.isPending}
            text={t("workspace.workflows.delete_workflow_confirmation", { name: workflowName })}
          />
        </>
      ) : null}
    </div>
  );
};
