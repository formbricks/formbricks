"use client";

import { BarChart, DatabaseIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TChartConfig } from "@formbricks/types/analysis";
import { cn } from "@/lib/cn";
import { ChartErrorBoundary } from "@/modules/ee/analysis/charts/components/chart-error-boundary";
import { ChartRenderer } from "@/modules/ee/analysis/charts/components/chart-renderer";
import { DataViewer } from "@/modules/ee/analysis/charts/components/data-viewer";
import { AnalyticsResponse } from "@/modules/ee/analysis/types/analysis";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";

interface ChartPreviewProps {
  chartData: AnalyticsResponse | null;
  /** Display settings being edited, so the preview renders what will be saved. */
  config?: TChartConfig;
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  /** Chart type picker. It rides in the header because it changes this preview, nothing else. */
  typeControl?: ReactNode;
  /** Rendered as a strip under the chart, where its effect is visible without scrolling. */
  displaySettings?: ReactNode;
  className?: string;
}

/**
 * The stage: what the configuration produces, plus the controls that only change how it looks.
 * It carries no heading of its own — the chart is self-evidently the chart, and the row of view
 * controls says so more usefully than a label would.
 */
export function ChartPreview({
  chartData,
  config,
  isLoading = false,
  error,
  emptyMessage,
  typeControl,
  displaySettings,
  className,
}: Readonly<ChartPreviewProps>) {
  const [activeTab, setActiveTab] = useState<"chart" | "data">("chart");
  const { t } = useTranslation();

  const data = chartData?.data ?? [];
  const hasRenderableData = !isLoading && !error && !chartData?.error && data.length > 0;

  const handleTabChange = (value: string) => {
    if (value === "chart" || value === "data") {
      setActiveTab(value);
    }
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className="flex h-full min-h-48 items-center justify-center">
          <LoadingSpinner />
        </div>
      );
    }

    if (error || chartData?.error) {
      return (
        <div className="flex h-full min-h-48 items-center justify-center px-6 text-center text-sm text-red-600">
          {error || chartData?.error}
        </div>
      );
    }

    if (!chartData) {
      return (
        <div className="flex h-full min-h-48 items-center justify-center px-6 text-center text-sm text-slate-500">
          {emptyMessage ?? t("workspace.analysis.charts.no_data_available")}
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className="flex h-full min-h-48 items-center justify-center px-6 text-center text-sm text-slate-500">
          {t("workspace.analysis.charts.no_data_returned")}
        </div>
      );
    }

    return (
      <>
        <TabsContent value="chart" className="mt-0 h-full">
          <ChartErrorBoundary fallbackMessage={t("workspace.analysis.charts.chart_render_error")}>
            <ChartRenderer
              chartType={chartData.chartType}
              data={data}
              query={chartData.query}
              optionLabels={chartData.optionLabels}
              config={config}
            />
          </ChartErrorBoundary>
        </TabsContent>

        <TabsContent value="data" className="mt-0">
          <DataViewer data={data} optionLabels={chartData.optionLabels} />
        </TabsContent>
      </>
    );
  };

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
        className
      )}>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
          {typeControl && <div className="min-w-0 flex-1 basis-96">{typeControl}</div>}
          {/*
            Always rendered, disabled until there is something to look at: appearing only once the
            query resolves moved everything beside it, and the header is the one row in this dialog
            that must not shift while the user is aiming at it.
          */}
          <TabsList className="ml-auto shrink-0">
            <TabsTrigger value="chart" disabled={!hasRenderableData} icon={<BarChart className="size-4" />}>
              {t("workspace.analysis.charts.chart")}
            </TabsTrigger>
            <TabsTrigger
              value="data"
              disabled={!hasRenderableData}
              icon={<DatabaseIcon className="size-4" />}>
              {t("workspace.analysis.charts.chart_data_tab")}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">{renderBody()}</div>
      </Tabs>

      {displaySettings && (
        <div className="shrink-0 border-t border-slate-100 px-4 py-3">{displaySettings}</div>
      )}
    </div>
  );
}
