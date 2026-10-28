"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { CreateDashboardDialog } from "@/modules/ee/analysis/dashboards/components/create-dashboard-dialog";
import { createDashboard, getChartApiErrorMessage } from "@/modules/ee/analysis/lib/api-client";
import { dashboardKeys } from "@/modules/ee/analysis/lib/query";
import { Button, type ButtonProps } from "@/modules/ui/components/button";

interface CreateDashboardButtonProps {
  workspaceId: string;
  disabled?: boolean;
  buttonProps?: Omit<ButtonProps, "onClick" | "children" | "disabled">;
}

export const CreateDashboardButton = ({
  workspaceId,
  disabled = false,
  buttonProps,
}: Readonly<CreateDashboardButtonProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [dashboardName, setDashboardName] = useState("");
  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: createDashboard,
    onSettled: () => queryClient.invalidateQueries({ queryKey: dashboardKeys.lists() }),
  });

  const handleOpenChange = (open: boolean) => {
    setIsCreateDialogOpen(open);
    if (!open) {
      setDashboardName("");
    }
  };

  const handleCreate = () => {
    const name = dashboardName.trim();
    if (!name) {
      toast.error(t("workspace.analysis.dashboards.please_enter_name"));
      return;
    }

    createMutation.mutate(
      { workspaceId, name },
      {
        onSuccess: (dashboard) => {
          toast.success(t("workspace.analysis.dashboards.create_success"));
          handleOpenChange(false);
          router.push(`/workspaces/${workspaceId}/dashboards/${dashboard.id}`);
        },
        onError: (error) =>
          toast.error(getChartApiErrorMessage(error, t("workspace.analysis.dashboards.create_failed"))),
      }
    );
  };

  return (
    <>
      <Button size="sm" onClick={() => handleOpenChange(true)} disabled={disabled} {...buttonProps}>
        {t("workspace.analysis.dashboards.new_dashboard")}
        <PlusIcon />
      </Button>
      <CreateDashboardDialog
        open={isCreateDialogOpen}
        onOpenChange={handleOpenChange}
        dashboardName={dashboardName}
        onDashboardNameChange={setDashboardName}
        onCreate={handleCreate}
        isCreating={createMutation.isPending}
      />
    </>
  );
};
