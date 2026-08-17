"use client";

import { useTranslation } from "react-i18next";
import type { TChartConfig } from "@formbricks/types/analysis";
import { ChartErrorBoundary } from "@/modules/ee/analysis/charts/components/chart-error-boundary";
import { ChartRenderer } from "@/modules/ee/analysis/charts/components/chart-renderer";
import { AnalyticsResponse } from "@/modules/ee/analysis/types/analysis";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

interface ChartPreviewProps {
  chartData: AnalyticsResponse | null;
  /** Display settings being edited, so the preview shows what will be saved. */
  config?: TChartConfig;
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
}

export function ChartPreview({
  chartData,
  config,
  isLoading = false,
  error,
  emptyMessage,
}: Readonly<ChartPreviewProps>) {
  const { t } = useTranslation();

  const data = chartData?.data ?? [];

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex h-48 items-center justify-center">
          <LoadingSpinner />
        </div>
      );
    }

    if (error || chartData?.error) {
      return (
        <div className="flex h-48 items-center justify-center text-sm text-red-600">
          {error || chartData?.error}
        </div>
      );
    }

    if (!chartData) {
      return (
        <div className="flex h-48 items-center justify-center px-6 text-center text-sm text-gray-500">
          {emptyMessage ?? t("workspace.analysis.charts.no_data_available")}
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className="flex h-48 items-center justify-center px-6 text-center text-sm text-gray-500">
          {t("workspace.analysis.charts.no_data_returned")}
        </div>
      );
    }

    // The renderer resolves the display settings, so the preview shows the chart or its data
    // table exactly as the saved chart will render it.
    return (
      <ChartErrorBoundary fallbackMessage={t("workspace.analysis.charts.chart_render_error")}>
        <ChartRenderer
          chartType={chartData.chartType}
          data={data}
          query={chartData.query}
          optionLabels={chartData.optionLabels}
          config={config}
        />
      </ChartErrorBoundary>
    );
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
      <h3 className="mb-4 font-semibold text-gray-900">{t("workspace.analysis.charts.chart_preview")}</h3>
      {renderContent()}
    </div>
  );
}
