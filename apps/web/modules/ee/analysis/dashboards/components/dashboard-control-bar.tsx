"use client";

import { CheckIcon, PencilIcon, RefreshCwIcon, TrashIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { deleteDashboardAction } from "@/modules/ee/analysis/dashboards/actions";
import { AddExistingChartsDialog } from "@/modules/ee/analysis/dashboards/components/add-existing-charts-dialog";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { IconBar } from "@/modules/ui/components/iconbar";

interface DashboardControlBarProps {
  workspaceId: string;
  dashboardId: string;
  directories: { id: string; name: string }[];
  existingChartIds: string[];
  isEditing: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  isReadOnly: boolean;
  onRefresh: () => void;
  onEditToggle: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export const DashboardControlBar = ({
  workspaceId,
  dashboardId,
  directories,
  existingChartIds,
  isEditing,
  isSaving,
  hasChanges,
  isReadOnly,
  onRefresh,
  onEditToggle,
  onSave,
  onCancel,
}: Readonly<DashboardControlBarProps>) => {
  const router = useRouter();
  const { t } = useTranslation();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddExistingDialogOpen, setIsAddExistingDialogOpen] = useState(false);

  const handleDeleteDashboard = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteDashboardAction({ workspaceId, dashboardId });
      if (result?.data) {
        router.push(`/workspaces/${workspaceId}/dashboards`);
        toast.success(t("workspace.analysis.dashboards.delete_success"));
      } else {
        const errorMessage = getFormattedErrorMessage(result);
        toast.error(errorMessage);
      }
    } catch {
      toast.error(t("workspace.analysis.dashboards.delete_failed"));
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const editModeActions = [
    {
      icon: CheckIcon,
      tooltip: hasChanges ? t("common.save") : t("common.no_changes"),
      onClick: onSave,
      isVisible: true,
      isLoading: isSaving,
      disabled: isSaving || !hasChanges,
    },
    {
      icon: XIcon,
      tooltip: t("common.cancel"),
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
      <div className="flex items-center gap-2">
        <IconBar actions={isEditing ? editModeActions : viewModeActions} />
        {!isEditing && !isReadOnly && (
          <Button onClick={() => setIsAddExistingDialogOpen(true)}>{t("common.add_chart")}</Button>
        )}
      </div>
      <DeleteDialog
        deleteWhat={t("workspace.analysis.dashboards.dashboard")}
        open={isDeleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        onDelete={handleDeleteDashboard}
        text={t("workspace.analysis.dashboards.dashboard_delete_confirmation")}
        isDeleting={isDeleting}
      />
      <AddExistingChartsDialog
        open={isAddExistingDialogOpen}
        onOpenChange={setIsAddExistingDialogOpen}
        workspaceId={workspaceId}
        dashboardId={dashboardId}
        directories={directories}
        existingChartIds={existingChartIds}
        onSuccess={() => {
          setIsAddExistingDialogOpen(false);
          router.refresh();
        }}
      />
    </>
  );
};
