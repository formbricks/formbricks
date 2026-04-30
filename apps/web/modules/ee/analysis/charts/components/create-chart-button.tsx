"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CreateChartDialog } from "@/modules/ee/analysis/charts/components/create-chart-dialog";
import { Button, type ButtonProps } from "@/modules/ui/components/button";

interface CreateChartButtonProps {
  workspaceId: string;
  autoAddToDashboardId?: string;
  label?: string;
  onSuccess?: () => void;
  showIcon?: boolean;
  buttonProps?: Omit<ButtonProps, "onClick" | "children">;
}

export function CreateChartButton({
  workspaceId,
  autoAddToDashboardId,
  label,
  onSuccess,
  showIcon = true,
  buttonProps,
}: Readonly<CreateChartButtonProps>) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <Button size="sm" onClick={() => setIsDialogOpen(true)} {...buttonProps}>
        {showIcon && <PlusIcon className="mr-2 h-4 w-4" />}
        {label ?? t("workspace.analysis.charts.create_chart")}
      </Button>
      <CreateChartDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        workspaceId={workspaceId}
        autoAddToDashboardId={autoAddToDashboardId}
        onSuccess={onSuccess}
      />
    </>
  );
}
