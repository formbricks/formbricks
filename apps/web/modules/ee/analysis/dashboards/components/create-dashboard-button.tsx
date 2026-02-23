"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { createDashboardAction } from "../actions";
import { CreateDashboardDialog } from "./create-dashboard-dialog";

interface CreateDashboardButtonProps {
  environmentId: string;
}

export const CreateDashboardButton = ({ environmentId }: Readonly<CreateDashboardButtonProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [dashboardName, setDashboardName] = useState("");
  const [dashboardDescription, setDashboardDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsCreateDialogOpen(open);
    if (!open) {
      setDashboardName("");
      setDashboardDescription("");
    }
  };

  const handleCreate = async () => {
    if (!dashboardName.trim()) {
      toast.error(t("environments.analysis.dashboards.please_enter_name"));
      return;
    }

    setIsCreating(true);
    try {
      const result = await createDashboardAction({
        environmentId,
        name: dashboardName.trim(),
        description: dashboardDescription.trim() || undefined,
      });

      if (!result?.data) {
        toast.error(result?.serverError || t("environments.analysis.dashboards.create_failed"));
        return;
      }

      toast.success(t("environments.analysis.dashboards.create_success"));
      handleOpenChange(false);
      router.push(`/environments/${environmentId}/analysis/dashboards/${result.data.id}`);
    } catch {
      toast.error(t("environments.analysis.dashboards.create_failed"));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Button onClick={() => handleOpenChange(true)}>
        <PlusIcon className="mr-2 h-4 w-4" />
        {t("environments.analysis.dashboards.create_dashboard")}
      </Button>
      <CreateDashboardDialog
        open={isCreateDialogOpen}
        onOpenChange={handleOpenChange}
        dashboardName={dashboardName}
        onDashboardNameChange={setDashboardName}
        dashboardDescription={dashboardDescription}
        onDashboardDescriptionChange={setDashboardDescription}
        onCreate={handleCreate}
        isCreating={isCreating}
      />
    </>
  );
};
