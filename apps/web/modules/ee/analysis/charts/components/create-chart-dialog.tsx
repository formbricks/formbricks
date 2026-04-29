"use client";

import { CreateChartView } from "@/modules/ee/analysis/charts/components/create-chart-view";
import type { TChartWithCreator } from "@/modules/ee/analysis/types/analysis";

export interface CreateChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  chartId?: string;
  autoAddToDashboardId?: string;
  initialChart?: TChartWithCreator;
  onSuccess?: () => void;
  directories: { id: string; name: string }[];
}

export function CreateChartDialog({
  open,
  onOpenChange,
  workspaceId,
  chartId,
  autoAddToDashboardId,
  initialChart,
  onSuccess,
  directories,
}: Readonly<CreateChartDialogProps>) {
  return (
    <CreateChartView
      open={open}
      onOpenChange={onOpenChange}
      workspaceId={workspaceId}
      chartId={chartId}
      initialChart={initialChart}
      autoAddToDashboardId={autoAddToDashboardId}
      onSuccess={onSuccess}
      directories={directories}
    />
  );
}
