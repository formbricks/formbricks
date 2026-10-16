"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CopyPlusIcon,
  MoreVertical,
  SquarePenIcon,
  TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { useCreativeRowActions } from "../hooks/use-creatives-list";
import type { TCreativeListItem } from "../lib/list-api";
import { getCreativeEditPath } from "../lib/paths";

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
  const { duplicate, archive, restore, remove } = useCreativeRowActions();
  const isArchived = creative.displayStatus === "archived";
  const name = creative.name || t("workspace.creatives.untitled_creative");
  const fallbackError = t("common.something_went_wrong_please_try_again");
  const onError = (error: Error) => toast.error(getV3ApiErrorMessage(error, fallbackError));

  const handleDuplicate = () =>
    duplicate.mutate(creative.id, {
      onSuccess: () => toast.success(t("workspace.creatives.toast_duplicated")),
      onError,
    });

  const handleArchive = () =>
    archive.mutate(creative.id, {
      onSuccess: () => toast.success(t("workspace.creatives.toast_archived", { name })),
      onError,
    });

  // Restoring brings a creative back as a Draft when its Destination was unlinked while it was archived.
  const handleRestore = () =>
    restore.mutate(creative.id, {
      onSuccess: (restored) =>
        toast.success(
          restored.status === "draft" && creative.status !== "draft"
            ? t("workspace.creatives.toast_restored_as_draft", { name })
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
              onSelect={() => router.push(getCreativeEditPath(workspaceId, creative.id))}>
              {t("common.edit")}
            </DropdownMenuItem>
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
                onSelect={handleArchive}>
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
                setIsDeleteDialogOpen(true);
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
        isDeleting={remove.isPending}
      />
    </>
  );
};
