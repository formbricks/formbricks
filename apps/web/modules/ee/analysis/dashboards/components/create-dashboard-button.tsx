"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createDashboardAction } from "@/modules/ee/analysis/dashboards/actions";
import { CreateDashboardDialog } from "@/modules/ee/analysis/dashboards/components/create-dashboard-dialog";
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
  const [isCreating, setIsCreating] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsCreateDialogOpen(open);
    if (!open) {
      setDashboardName("");
    }
  };

  const handleCreate = async () => {
    if (!dashboardName.trim()) {
      toast.error(t("workspace.analysis.dashboards.please_enter_name"));
      return;
    }

    setIsCreating(true);
    try {
      const result = await createDashboardAction({
        workspaceId,
        name: dashboardName.trim(),
      });

      if (!result?.data) {
        const errorMessage = getFormattedErrorMessage(result);
        toast.error(errorMessage);
        return;
      }

      toast.success(t("workspace.analysis.dashboards.create_success"));
      handleOpenChange(false);
      router.push(`/workspaces/${workspaceId}/dashboards/${result.data.id}`);
    } catch {
      toast.error(t("workspace.analysis.dashboards.create_failed"));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => handleOpenChange(true)} disabled={disabled} {...buttonProps}>
        <PlusIcon className="mr-2 size-4" />
        {t("workspace.analysis.dashboards.create_dashboard")}
      </Button>
      <CreateDashboardDialog
        open={isCreateDialogOpen}
        onOpenChange={handleOpenChange}
        dashboardName={dashboardName}
        onDashboardNameChange={setDashboardName}
        onCreate={handleCreate}
        isCreating={isCreating}
      />
    </>
  );
};
