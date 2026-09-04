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
  /** Reopens the AI dialog for someone who started from scratch and wants a hand. */
  onRequestAIDialog?: () => void;
  onSuccess?: () => void;
  directories: { id: string; name: string }[];
  isAIAvailable?: boolean;
}

export function CreateChartDialog({
  open,
  onOpenChange,
  workspaceId,
  chartId,
  autoAddToDashboardId,
  initialChart,
  generatedChart,
  onRequestAIDialog,
  onSuccess,
  directories,
  isAIAvailable,
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
        onRequestAIDialog={onRequestAIDialog}
        autoAddToDashboardId={autoAddToDashboardId}
        onSuccess={onSuccess}
        directories={directories}
        isAIAvailable={isAIAvailable}
      />
    </ChartsQueryClientProvider>
  );
}
