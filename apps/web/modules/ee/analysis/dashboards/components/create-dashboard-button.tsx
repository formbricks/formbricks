"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/modules/ui/components/button";
import { createDashboardAction } from "../actions";
import { CreateDashboardDialog } from "./create-dashboard-dialog";

interface CreateDashboardButtonProps {
  environmentId: string;
}

export function CreateDashboardButton({ environmentId }: CreateDashboardButtonProps) {
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [dashboardName, setDashboardName] = useState("");
  const [dashboardDescription, setDashboardDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateDashboard = () => {
    setIsCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!dashboardName.trim()) {
      toast.error("Please enter a dashboard name");
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
        toast.error(result?.serverError || "Failed to create dashboard");
        return;
      }

      toast.success("Dashboard created successfully!");
      setIsCreateDialogOpen(false);
      setDashboardName("");
      setDashboardDescription("");
      router.push(`/environments/${environmentId}/analysis/dashboards/${result.data.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create dashboard";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Button onClick={handleCreateDashboard}>
        <PlusIcon className="mr-2 h-4 w-4" />
        Create Dashboard
      </Button>
      <CreateDashboardDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        dashboardName={dashboardName}
        onDashboardNameChange={setDashboardName}
        dashboardDescription={dashboardDescription}
        onDashboardDescriptionChange={setDashboardDescription}
        onCreate={handleCreate}
        isCreating={isCreating}
      />
    </>
  );
}
