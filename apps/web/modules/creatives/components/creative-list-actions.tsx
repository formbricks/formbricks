"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CircleCheckIcon,
  CopyPlusIcon,
  type LucideIcon,
  MoreVertical,
  PauseIcon,
  PlayIcon,
  SquarePenIcon,
  TrashIcon,
  ZapIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { useCreativeStatusChange } from "../hooks/use-creative-status-change";
import { useCreativeRowActions } from "../hooks/use-creatives-list";
import { findSurveyLeftUnopened } from "../lib/last-opener-check";
import type { TCreativeListItem } from "../lib/list-api";
import { getCreativeEditPath } from "../lib/paths";
import { type TRowStatusAction, getRowStatusActions } from "../lib/summary";

const STATUS_ACTION_ICONS: Record<TRowStatusAction["action"], LucideIcon> = {
  publish: ZapIcon,
  pause: PauseIcon,
  keepPaused: PauseIcon,
  resume: PlayIcon,
  close: CircleCheckIcon,
  reopen: PlayIcon,
};

interface CreativeListActionsProps {
  workspaceId: string;
  creative: TCreativeListItem;
}

/** The row menu, built like the surveys and workflows lists' options menu. Writers only. */
export const CreativeListActions = ({ workspaceId, creative }: Readonly<CreativeListActionsProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  // The survey this creative is the last to open, while archiving or deleting it asks first (A1).
  const [unopenedSurvey, setUnopenedSurvey] = useState<string | null>(null);
  const [isArchiveWarningOpen, setIsArchiveWarningOpen] = useState(false);
  const { duplicate, archive, restore, remove } = useCreativeRowActions();
  const statusChange = useCreativeStatusChange(creative.id);
  const isArchived = creative.displayStatus === "archived";
  const name = creative.name || t("workspace.creatives.untitled_creative");
  const fallbackError = t("common.something_went_wrong_please_try_again");
  const onError = (error: Error) => toast.error(getV3ApiErrorMessage(error, fallbackError));
  const editPath = getCreativeEditPath(workspaceId, creative.id);
  const statusActionLabels: Record<TRowStatusAction["action"], string> = {
    publish: t("workspace.creatives.editor.publish"),
    pause: t("workspace.creatives.status_action_pause"),
    keepPaused: t("workspace.creatives.status_action_keep_paused"),
    resume: t("workspace.creatives.status_action_resume"),
    close: t("workspace.creatives.status_action_close"),
    reopen: t("workspace.creatives.status_action_reopen"),
  };
  // A draft's Publish opens the editor, which checks it before it goes live.
  const runStatusAction = (item: TRowStatusAction) => {
    if (item.action === "publish") router.push(editPath);
    else statusChange.changeStatus(item.status);
  };

  const handleDuplicate = () =>
    duplicate.mutate(creative.id, {
      onSuccess: () => toast.success(t("workspace.creatives.toast_duplicated")),
      onError,
    });

  const archiveNow = () =>
    archive.mutate(creative.id, {
      onSuccess: () => {
        toast.success(t("workspace.creatives.toast_archived", { name }));
        setIsArchiveWarningOpen(false);
      },
      onError,
    });

  const handleArchive = async () => {
    const survey = await findSurveyLeftUnopened(workspaceId, creative);
    setUnopenedSurvey(survey);
    if (survey) setIsArchiveWarningOpen(true);
    else archiveNow();
  };

  const openDeleteDialog = async () => {
    setUnopenedSurvey(null);
    setIsDeleteDialogOpen(true);
    setUnopenedSurvey(await findSurveyLeftUnopened(workspaceId, creative));
  };

  // Restoring always brings a creative back as a Draft; one whose survey was unlinked has nothing to open.
  const handleRestore = () =>
    restore.mutate(creative.id, {
      onSuccess: (restored) =>
        toast.success(
          restored.warnings.some(({ code }) => code === "destinationMissing")
            ? t("workspace.creatives.toast_restored_without_destination", { name })
            : t("workspace.creatives.toast_restored", { name })
        ),
      onError,
    });

  const handleDelete = () =>
    remove.mutate(creative.id, {
      onSuccess: () => {
        toast.success(t("workspace.creatives.toast_deleted"));
        setIsDeleteDialogOpen(false);
      },
      onError,
    });

  return (
    <>
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger className="z-10" asChild>
          <button
            type="button"
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
              onSelect={() => router.push(editPath)}>
              {t("common.edit")}
            </DropdownMenuItem>
            {getRowStatusActions(creative).map((item) => {
              const Icon = STATUS_ACTION_ICONS[item.action];
              return (
                <DropdownMenuItem
                  key={item.action}
                  icon={<Icon className="size-4" />}
                  disabled={statusChange.isPending}
                  onSelect={() => runStatusAction(item)}>
                  {statusActionLabels[item.action]}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuItem
              icon={<CopyPlusIcon className="size-4" />}
              disabled={duplicate.isPending}
              onSelect={handleDuplicate}>
              {t("common.duplicate")}
            </DropdownMenuItem>
            {isArchived ? (
              <DropdownMenuItem
                icon={<ArchiveRestoreIcon className="size-4" />}
                disabled={restore.isPending}
                onSelect={handleRestore}>
                {t("workspace.creatives.restore")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                icon={<ArchiveIcon className="size-4" />}
                disabled={archive.isPending}
                onSelect={() => void handleArchive()}>
                {t("common.archive")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              icon={<TrashIcon className="size-4" />}
              onSelect={(event) => {
                // Same as the workflows list: close the menu ourselves, then open the dialog, so the
                // menu's focus return doesn't fight the dialog's.
                event.preventDefault();
                setIsMenuOpen(false);
                void openDeleteDialog();
              }}>
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteDialog
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        deleteWhat={t("workspace.creatives.creative")}
        text={t("workspace.creatives.delete_confirmation", { name })}
        onDelete={handleDelete}
        isDeleting={remove.isPending}>
        {unopenedSurvey && (
          <p className="text-sm text-amber-700">
            {t("workspace.creatives.last_opener_warning", { survey: unopenedSurvey })}
          </p>
        )}
      </DeleteDialog>

      <ConfirmationModal
        open={isArchiveWarningOpen}
        setOpen={setIsArchiveWarningOpen}
        title={t("workspace.creatives.last_opener_title", { survey: unopenedSurvey ?? "" })}
        // Archiving can be undone: the modal's default says it can't.
        description={t("workspace.creatives.archive_restore_note")}
        body={
          <p className="text-sm text-slate-700">
            {t("workspace.creatives.last_opener_warning", { survey: unopenedSurvey ?? "" })}
          </p>
        }
        buttonText={t("workspace.creatives.archive_anyway")}
        buttonVariant="default"
        buttonLoading={archive.isPending}
        onConfirm={archiveNow}
      />
    </>
  );
};
