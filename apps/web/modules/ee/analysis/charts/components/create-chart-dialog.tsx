"use client";

import { CreateChartView } from "@/modules/ee/analysis/charts/components/create-chart-view";
import { ChartsQueryClientProvider } from "@/modules/ee/analysis/charts/components/query-client-provider";
import type { AnalyticsResponse, TChartWithCreator } from "@/modules/ee/analysis/types/analysis";

export interface CreateChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  chartId?: string;
  autoAddToDashboardId?: string;
  initialChart?: TChartWithCreator;
  /** A chart the AI dialog just produced, opened here for review and naming. */
  generatedChart?: AnalyticsResponse | null;
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
  generatedChart,
  onSuccess,
  directories,
}: Readonly<CreateChartDialogProps>) {
  return (
    <ChartsQueryClientProvider>
      <CreateChartView
        open={open}
        onOpenChange={onOpenChange}
        workspaceId={workspaceId}
        chartId={chartId}
        initialChart={initialChart}
        generatedChart={generatedChart}
        autoAddToDashboardId={autoAddToDashboardId}
        onSuccess={onSuccess}
        directories={directories}
      />
    </ChartsQueryClientProvider>
  );
}
