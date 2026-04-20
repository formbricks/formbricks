"use client";

import { CreateChartView } from "@/modules/ee/analysis/charts/components/create-chart-view";
import { EditChartView } from "@/modules/ee/analysis/charts/components/edit-chart-view";
import type { TChartWithCreator } from "@/modules/ee/analysis/types/analysis";

export interface CreateChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  chartId?: string;
  initialChart?: TChartWithCreator;
  onSuccess?: () => void;
  directories: { id: string; name: string }[];
}

export function CreateChartDialog({
  open,
  onOpenChange,
  workspaceId,
  chartId,
  initialChart,
  onSuccess,
  directories,
}: Readonly<CreateChartDialogProps>) {
  if (chartId) {
    return (
      <EditChartView
        open={open}
        onOpenChange={onOpenChange}
        workspaceId={workspaceId}
        chartId={chartId}
        initialChart={initialChart}
        onSuccess={onSuccess}
        directories={directories}
      />
    );
  }

  return (
    <CreateChartView
      open={open}
      onOpenChange={onOpenChange}
      workspaceId={workspaceId}
      onSuccess={onSuccess}
      directories={directories}
    />
  );
}
