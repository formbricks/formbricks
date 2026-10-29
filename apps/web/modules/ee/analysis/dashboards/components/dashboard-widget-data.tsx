"use client";

import { useTranslation } from "react-i18next";
import type { TChartConfig } from "@formbricks/types/analysis";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { ChartRenderer } from "@/modules/ee/analysis/charts/components/chart-renderer";
import { DataViewer } from "@/modules/ee/analysis/charts/components/data-viewer";
import { DEFAULT_WIDGET_VIEW, type TWidgetView } from "@/modules/ee/analysis/dashboards/lib/widget-view";
import type { TChartDateRangeInput } from "@/modules/ee/analysis/lib/api-client";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";
import { useChartData } from "../hooks/use-chart-data";
import { DashboardWidgetSkeleton } from "./dashboard-widget-skeleton";

interface DashboardWidgetDataProps {
  chartId: string;
  /** The dashboard's date range, replacing the chart's own; `null` keeps the chart's. */
  dateRange: TChartDateRangeInput | null;
  chartType: TChartType;
  /** Saved display settings of the chart behind this widget. */
  config?: TChartConfig;
  view?: TWidgetView;
}

/**
 * One widget's data, fetched by the widget itself from the chart data API: a slow or failing chart
 * shows its own spinner or error and never holds up the others.
 */
export function DashboardWidgetData({
  chartId,
  dateRange,
  chartType,
  config,
  view = DEFAULT_WIDGET_VIEW,
}: Readonly<DashboardWidgetDataProps>) {
  const { t } = useTranslation();
  const { data: result, isPending, isError, error } = useChartData({ chartId, dateRange });

  if (isPending) return <DashboardWidgetSkeleton />;

  if (isError) {
    // A refused query says what to change (e.g. a date range too wide for an hourly chart); show it.
    const reason = error instanceof V3ApiError ? error.invalid_params?.[0]?.reason : undefined;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center text-sm">
        <p className="text-red-500">{t("workspace.analysis.dashboards.failed_to_load_chart_data")}</p>
        {reason && <p className="text-xs text-slate-500">{reason}</p>}
      </div>
    );
  }

  // The data view reuses the chart builder's table, so the numbers behind a widget read the same
  // way in both places — bare, because the widget's own title bar and body already provide the
  // heading and the scroll container.
  if (view === "data") {
    return (
      <DataViewer
        data={result.rows}
        optionLabels={result.optionLabels}
        fieldLabels={result.fieldLabels}
        query={result.query}
        bare
      />
    );
  }

  // The query as it ran, not the saved one: the option-label lookup only applies when the x-axis
  // dimension is the effective value_id dimension.
  return (
    <ChartRenderer
      chartType={chartType}
      data={result.rows}
      query={result.query}
      optionLabels={result.optionLabels}
      fieldLabels={result.fieldLabels}
      config={config}
    />
  );
}
