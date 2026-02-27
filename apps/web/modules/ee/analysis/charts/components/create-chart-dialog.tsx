"use client";

import { CreateChartView } from "@/modules/ee/analysis/charts/components/create-chart-view";
import { EditChartView } from "@/modules/ee/analysis/charts/components/edit-chart-view";
import type { TChartWithCreator } from "@/modules/ee/analysis/types/analysis";

export interface CreateChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environmentId: string;
  chartId?: string;
  initialChart?: TChartWithCreator;
  onSuccess?: () => void;
}

export function CreateChartDialog({
  open,
  onOpenChange,
  environmentId,
  chartId,
  initialChart,
  onSuccess,
}: Readonly<CreateChartDialogProps>) {
  if (chartId) {
    return (
      <EditChartView
        open={open}
        onOpenChange={onOpenChange}
        environmentId={environmentId}
        chartId={chartId}
        initialChart={initialChart}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <CreateChartView
      open={open}
      onOpenChange={onOpenChange}
      environmentId={environmentId}
      onSuccess={onSuccess}
    />
  );
}
