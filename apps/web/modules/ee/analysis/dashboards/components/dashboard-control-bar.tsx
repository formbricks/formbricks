"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChartColumnIcon,
  CheckIcon,
  ImageIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  TrashIcon,
  TypeIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TLayoutBlockKind } from "@/modules/ee/analysis/dashboards/lib/widget-blocks";
import { deleteDashboard, getChartApiErrorMessage } from "@/modules/ee/analysis/lib/api-client";
import { dashboardKeys } from "@/modules/ee/analysis/lib/query";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { IconBar } from "@/modules/ui/components/iconbar";

interface DashboardControlBarProps {
  workspaceId: string;
  dashboardId: string;
  isEditing: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  isReadOnly: boolean;
  onRefresh: () => void;
  /** Opens the chart picker for the current page. */
  onAddChart: () => void;
  /** Drops a layout block on the current page, in its next free slot. */
  onAddBlock: (kind: TLayoutBlockKind) => void;
  /**
   * Single-key shortcut that toggles edit mode. Its key cap sits on whichever button it currently
   * triggers: the pencil in view mode, save while there are changes, cancel while there are none.
   */
  editHotkey?: string;
  onEditToggle: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export const DashboardControlBar = ({
  workspaceId,
  dashboardId,
  isEditing,
  isSaving,
  hasChanges,
  isReadOnly,
  onRefresh,
  onAddChart,
  onAddBlock,
  editHotkey,
  onEditToggle,
  onSave,
  onCancel,
}: Readonly<DashboardControlBarProps>) => {
  const router = useRouter();
  const { t } = useTranslation();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: () => deleteDashboard(dashboardId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: dashboardKeys.detail(dashboardId) });
      return queryClient.invalidateQueries({ queryKey: dashboardKeys.lists() });
    },
  });

  const handleDeleteDashboard = () =>
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        router.push(`/workspaces/${workspaceId}/dashboards`);
        toast.success(t("workspace.analysis.dashboards.delete_success"));
      },
      onError: (error) =>
        toast.error(getChartApiErrorMessage(error, t("workspace.analysis.dashboards.delete_failed"))),
      onSettled: () => setDeleteDialogOpen(false),
    });

  const editModeActions = [
    {
      icon: isSaving ? null : CheckIcon,
      tooltip: hasChanges ? t("common.save") : t("common.no_changes"),
      shortcut: hasChanges && !isSaving ? editHotkey : undefined,
      onClick: onSave,
      isVisible: true,
      isLoading: isSaving,
      disabled: isSaving || !hasChanges,
    },
    {
      icon: XIcon,
      tooltip: t("common.cancel"),
      shortcut: !hasChanges && !isSaving ? editHotkey : undefined,
      onClick: onCancel,
      isVisible: true,
      disabled: isSaving,
    },
  ];

  const viewModeActions = [
    {
      icon: RefreshCwIcon,
      tooltip: t("common.refresh"),
      onClick: onRefresh,
      isVisible: true,
    },
    {
      icon: PencilIcon,
      tooltip: t("common.edit"),
      shortcut: editHotkey,
      onClick: onEditToggle,
      isVisible: !isReadOnly,
    },
    {
      icon: TrashIcon,
      tooltip: t("common.delete"),
      onClick: () => setDeleteDialogOpen(true),
      isVisible: !isReadOnly,
    },
  ];

  return (
    <>
      {isEditing ? (
        <div className="flex items-center gap-2">
          {/* Add puts a chart (through the picker) or a layout block on the current page. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <PlusIcon />
                {t("common.add")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={onAddChart}>
                <ChartColumnIcon className="mr-2 size-4" />
                {t("common.chart")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAddBlock("image")}>
                <ImageIcon className="mr-2 size-4" />
                {t("common.image")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAddBlock("text")}>
                <TypeIcon className="mr-2 size-4" />
                {t("common.text")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAddBlock("separator")}>
                <MinusIcon className="mr-2 size-4" />
                {t("workspace.analysis.dashboards.separator")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <IconBar actions={editModeActions} />
        </div>
      ) : (
        <IconBar actions={viewModeActions} />
      )}
      <DeleteDialog
        deleteWhat={t("workspace.analysis.dashboards.dashboard")}
        open={isDeleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        onDelete={handleDeleteDashboard}
        text={t("workspace.analysis.dashboards.dashboard_delete_confirmation")}
        isDeleting={deleteMutation.isPending}
      />
    </>
  );
};
