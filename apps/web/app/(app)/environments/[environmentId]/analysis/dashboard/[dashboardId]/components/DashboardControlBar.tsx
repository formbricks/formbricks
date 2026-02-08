"use client";

import { CopyIcon, PencilIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TDashboard } from "../../../types/analysis";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { IconBar } from "@/modules/ui/components/iconbar";
import { EditDashboardDialog } from "./EditDashboardDialog";

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

  const handleDeleteDashboard = async () => {
    setIsDeleting(true);
    try {
      // TODO: Implement deleteDashboardAction when available
      // const result = await deleteDashboardAction({ environmentId, dashboardId: dashboard.id });
      // if (result?.data) {
      //   router.push(`/environments/${environmentId}/analysis/dashboards`);
      //   toast.success("Dashboard deleted successfully");
      // } else {
      //   toast.error(result?.serverError || "Failed to delete dashboard");
      // }
      toast.error("Delete functionality coming soon");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete dashboard");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleDuplicate = async () => {
    // TODO: Implement duplicate functionality
    toast.success("Duplicate functionality coming soon");
  };

  const iconActions = [
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
    </>
  );
};
