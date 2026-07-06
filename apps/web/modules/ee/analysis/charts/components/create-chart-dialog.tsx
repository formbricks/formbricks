"use client";

import { CreateChartView } from "@/modules/ee/analysis/charts/components/create-chart-view";
import { ChartsQueryClientProvider } from "@/modules/ee/analysis/charts/components/query-client-provider";
import type { TAIUnavailableReason } from "@/modules/ee/analysis/charts/lib/ai-availability";
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
  isAIAvailable?: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
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
  isAIAvailable,
  aiUnavailableReason,
}: Readonly<CreateChartDialogProps>) {
  return (
    <ChartsQueryClientProvider>
      <CreateChartView
        open={open}
        onOpenChange={onOpenChange}
        workspaceId={workspaceId}
        chartId={chartId}
        initialChart={initialChart}
        autoAddToDashboardId={autoAddToDashboardId}
        onSuccess={onSuccess}
        directories={directories}
        isAIAvailable={isAIAvailable}
        aiUnavailableReason={aiUnavailableReason}
      />
    </ChartsQueryClientProvider>
  );
}
