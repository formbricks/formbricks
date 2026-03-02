"use client";

import { CheckIcon, PencilIcon, PlusIcon, RefreshCwIcon, TrashIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { deleteDashboardAction } from "@/modules/ee/analysis/dashboards/actions";
import { AddExistingChartsDialog } from "@/modules/ee/analysis/dashboards/components/add-existing-charts-dialog";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { IconBar } from "@/modules/ui/components/iconbar";

interface DashboardControlBarProps {
  environmentId: string;
  dashboardId: string;
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
  environmentId,
  dashboardId,
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
      const result = await deleteDashboardAction({ environmentId, dashboardId });
      if (result?.data) {
        router.push(`/environments/${environmentId}/analysis/dashboards`);
        toast.success(t("environments.analysis.dashboards.delete_success"));
      } else {
        const errorMessage = getFormattedErrorMessage(result);
        toast.error(errorMessage);
      }
    } catch {
      toast.error(t("environments.analysis.dashboards.delete_failed"));
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
      icon: PlusIcon,
      tooltip: t("common.add_charts"),
      onClick: () => setIsAddExistingDialogOpen(true),
      isVisible: !isReadOnly,
    },
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
      <IconBar actions={isEditing ? editModeActions : viewModeActions} />
      <DeleteDialog
        deleteWhat={t("environments.analysis.dashboards.dashboard")}
        open={isDeleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        onDelete={handleDeleteDashboard}
        text={t("environments.analysis.dashboards.dashboard_delete_confirmation")}
        isDeleting={isDeleting}
      />
      <AddExistingChartsDialog
        open={isAddExistingDialogOpen}
        onOpenChange={setIsAddExistingDialogOpen}
        environmentId={environmentId}
        dashboardId={dashboardId}
        existingChartIds={existingChartIds}
        onSuccess={() => {
          setIsAddExistingDialogOpen(false);
          router.refresh();
        }}
      />
    </>
  );
};
