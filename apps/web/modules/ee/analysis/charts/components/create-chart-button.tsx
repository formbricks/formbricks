"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CreateChartDialog } from "@/modules/ee/analysis/charts/components/create-chart-dialog";
import { Button, type ButtonProps } from "@/modules/ui/components/button";

interface CreateChartButtonProps {
  workspaceId: string;
  directories: { id: string; name: string }[];
  autoAddToDashboardId?: string;
  label?: string;
  onSuccess?: () => void;
  showIcon?: boolean;
  buttonProps?: Omit<ButtonProps, "onClick" | "children">;
  isAIAvailable?: boolean;
  aiUnavailableReason?: string;
}

export function CreateChartButton({
  workspaceId,
  directories,
  autoAddToDashboardId,
  label,
  onSuccess,
  showIcon = true,
  buttonProps,
  isAIAvailable,
  aiUnavailableReason,
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
        directories={directories}
        onSuccess={onSuccess}
        isAIAvailable={isAIAvailable}
        aiUnavailableReason={aiUnavailableReason}
      />
    </>
  );
}
