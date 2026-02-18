"use client";

import { CopyIcon, PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { IconBar } from "@/modules/ui/components/iconbar";
import { deleteDashboardAction } from "../actions";
import { TDashboard } from "../types/analysis";
import { CreateChartDialog } from "./create-chart-dialog";
import { EditDashboardDialog } from "./edit-dashboard-dialog";

interface DashboardControlBarProps {
  environmentId: string;
  dashboard: TDashboard;
  onDashboardUpdate?: () => void;
}

export const DashboardControlBar = ({
  environmentId,
  dashboard,
  onDashboardUpdate,
}: DashboardControlBarProps) => {
  const router = useRouter();
  const { t } = useTranslation();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddChartDialogOpen, setIsAddChartDialogOpen] = useState(false);

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

  const handleDuplicate = async () => {
    toast.success("Duplicate functionality coming soon");
  };

  const iconActions = [
    {
      icon: PlusIcon,
      tooltip: t("common.add_chart"),
      onClick: () => {
        setIsAddChartDialogOpen(true);
      },
      isVisible: true,
    },
    {
      icon: PencilIcon,
      tooltip: t("common.edit"),
      onClick: () => {
        setIsEditDialogOpen(true);
      },
      isVisible: true,
    },
    {
      icon: CopyIcon,
      tooltip: t("common.duplicate"),
      onClick: handleDuplicate,
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
      <IconBar actions={iconActions} />
      <DeleteDialog
        deleteWhat="Dashboard"
        open={isDeleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        onDelete={handleDeleteDashboard}
        text="Are you sure you want to delete this dashboard? This action cannot be undone."
        isDeleting={isDeleting}
      />
      <EditDashboardDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        dashboardId={dashboard.id}
        environmentId={environmentId}
        initialName={dashboard.name}
        initialDescription={dashboard.description}
        onSuccess={() => {
          setIsEditDialogOpen(false);
          onDashboardUpdate?.();
          router.refresh();
        }}
      />
      <CreateChartDialog
        open={isAddChartDialogOpen}
        onOpenChange={setIsAddChartDialogOpen}
        environmentId={environmentId}
        defaultDashboardId={dashboard.id}
        onSuccess={() => {
          setIsAddChartDialogOpen(false);
          router.refresh();
        }}
      />
    </>
  );
};
