"use client";

import { CheckIcon, LibraryIcon, LockOpenIcon, PlusIcon, RefreshCwIcon, TrashIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { IconBar } from "@/modules/ui/components/iconbar";
import { deleteDashboardAction } from "../actions";
import { TDashboard } from "@/modules/ee/analysis/types/analysis";
import { CreateChartDialog } from "@/modules/ee/analysis/charts/components/create-chart-dialog";
import { AddExistingChartsDialog } from "./add-existing-charts-dialog";

interface DashboardControlBarProps {
  environmentId: string;
  dashboard: TDashboard;
  isEditing: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  onRefresh: () => void;
  onEditToggle: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export const DashboardControlBar = ({
  environmentId,
  dashboard,
  isEditing,
  isSaving,
  hasChanges,
  onRefresh,
  onEditToggle,
  onSave,
  onCancel,
}: DashboardControlBarProps) => {
  const router = useRouter();
  const { t } = useTranslation();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreateChartDialogOpen, setIsCreateChartDialogOpen] = useState(false);
  const [isAddExistingDialogOpen, setIsAddExistingDialogOpen] = useState(false);

  const handleDeleteDashboard = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteDashboardAction({ environmentId, dashboardId: dashboard.id });
      if (result?.data) {
        router.push(`/environments/${environmentId}/analysis/dashboards`);
        toast.success("Dashboard deleted successfully");
      } else {
        toast.error(result?.serverError || "Failed to delete dashboard");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete dashboard";
      toast.error(message);
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
      icon: LockOpenIcon,
      tooltip: t("common.unlock"),
      onClick: onEditToggle,
      isVisible: true,
    },
    {
      icon: LibraryIcon,
      tooltip: t("common.add_existing_chart"),
      onClick: () => {
        setIsAddExistingDialogOpen(true);
      },
      isVisible: true,
    },
    {
      icon: PlusIcon,
      tooltip: t("common.create_new_chart"),
      onClick: () => {
        setIsCreateChartDialogOpen(true);
      },
      isVisible: true,
    },
    {
      icon: TrashIcon,
      tooltip: t("common.delete"),
      onClick: () => {
        setDeleteDialogOpen(true);
      },
      isVisible: true,
    },
  ];

  return (
    <>
      <IconBar actions={isEditing ? editModeActions : viewModeActions} />
      <DeleteDialog
        deleteWhat="Dashboard"
        open={isDeleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        onDelete={handleDeleteDashboard}
        text="Are you sure you want to delete this dashboard? This action cannot be undone."
        isDeleting={isDeleting}
      />
      <AddExistingChartsDialog
        open={isAddExistingDialogOpen}
        onOpenChange={setIsAddExistingDialogOpen}
        environmentId={environmentId}
        dashboard={dashboard}
        onSuccess={() => {
          setIsAddExistingDialogOpen(false);
          router.refresh();
        }}
      />
      <CreateChartDialog
        open={isCreateChartDialogOpen}
        onOpenChange={setIsCreateChartDialogOpen}
        environmentId={environmentId}
        onSuccess={() => {
          setIsCreateChartDialogOpen(false);
          router.refresh();
        }}
      />
    </>
  );
};
