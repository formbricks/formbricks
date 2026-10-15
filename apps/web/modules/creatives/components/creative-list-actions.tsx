"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CopyIcon,
  CopyPlusIcon,
  MoreVertical,
  PauseIcon,
  PlayIcon,
  SquareChartGanttIcon,
  SquarePenIcon,
  TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { getCreativeEditPath, getCreativeSummaryPath } from "../lib/paths";
import type { TCreative } from "../types";

interface CreativeListActionsProps {
  workspaceId: string;
  creative: TCreative;
  onDuplicate: () => void;
  onTogglePause: () => void;
  onToggleArchived: () => void;
  onCopyId: () => void;
  onDelete: () => void;
}

/** The row menu, built like the surveys and workflows lists' options menu. */
export const CreativeListActions = ({
  workspaceId,
  creative,
  onDuplicate,
  onTogglePause,
  onToggleArchived,
  onCopyId,
  onDelete,
}: Readonly<CreativeListActionsProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const isPaused = creative.status === "paused";
  const canTogglePause = !creative.archivedAt && (creative.status === "inProgress" || isPaused);

  return (
    <DropdownMenu>
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
          {creative.status !== "draft" && (
            <DropdownMenuItem
              icon={<SquareChartGanttIcon className="size-4" />}
              onSelect={() => router.push(getCreativeSummaryPath(workspaceId, creative.id))}>
              {t("workspace.creatives.view_summary")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem icon={<CopyPlusIcon className="size-4" />} onSelect={onDuplicate}>
            {t("common.duplicate")}
          </DropdownMenuItem>
          {canTogglePause && (
            <DropdownMenuItem
              icon={isPaused ? <PlayIcon className="size-4" /> : <PauseIcon className="size-4" />}
              onSelect={onTogglePause}>
              {isPaused ? t("workspace.creatives.resume") : t("workspace.creatives.pause")}
            </DropdownMenuItem>
          )}
          {creative.status !== "draft" && (
            <DropdownMenuItem
              icon={
                creative.archivedAt ? (
                  <ArchiveRestoreIcon className="size-4" />
                ) : (
                  <ArchiveIcon className="size-4" />
                )
              }
              onSelect={onToggleArchived}>
              {creative.archivedAt ? t("workspace.creatives.restore") : t("common.archive")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem icon={<CopyIcon className="size-4" />} onSelect={onCopyId}>
            {t("workspace.creatives.copy_id")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<TrashIcon className="size-4" />} onSelect={onDelete}>
            {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
