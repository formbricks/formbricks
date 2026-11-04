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
import type { TDashboardFilterPicks } from "../lib/dashboard-filters";
import { DashboardWidgetSkeleton } from "./dashboard-widget-skeleton";

interface DashboardWidgetDataProps {
  dashboardId: string;
  chartId: string;
  /** The dashboard's date range, narrowing the chart's own; `null` keeps the chart's. */
  dateRange: TChartDateRangeInput | null;
  /** The person's dashboard filter picks, each ANDed onto the chart's saved filters. */
  picks: TDashboardFilterPicks;
  chartType: TChartType;
  /** Saved display settings of the chart behind this widget. */
  config?: TChartConfig;
  view?: TWidgetView;
}

/**
 * One widget's data, fetched by the widget itself through its dashboard: a slow or failing chart shows its
 * own spinner or error and never holds up the others.
 */
export function DashboardWidgetData({
  dashboardId,
  chartId,
  dateRange,
  picks,
  chartType,
  config,
  view = DEFAULT_WIDGET_VIEW,
}: Readonly<DashboardWidgetDataProps>) {
  const { t } = useTranslation();
  const {
    data: result,
    isPending,
    isError,
    error,
  } = useChartData({ dashboardId, chartId, dateRange, picks });

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

  // A pick on a field this chart's Feedback Dataset lacks: it cannot be narrowed to the pick, so it shows
  // nothing, and says why rather than looking like a chart with no data.
  if (result.unfilterableFilters.length > 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-500">
        {t("workspace.analysis.dashboards.chart_cannot_be_filtered_by", {
          label: result.unfilterableFilters.map((filter) => filter.label).join(", "),
        })}
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
        memberLabels={result.memberLabels}
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
      memberLabels={result.memberLabels}
      config={config}
    />
  );
}
