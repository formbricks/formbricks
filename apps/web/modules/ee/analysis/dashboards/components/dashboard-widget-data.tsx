"use client";

import { use } from "react";
import { useTranslation } from "react-i18next";
import { TChartQuery } from "@formbricks/types/analysis";
import { ChartRenderer } from "@/modules/ee/analysis/charts/components/chart-renderer";
import { DataViewer } from "@/modules/ee/analysis/charts/components/data-viewer";
import { DEFAULT_WIDGET_VIEW, type TWidgetView } from "@/modules/ee/analysis/dashboards/lib/widget-view";
import type { TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";
import type { TDashboardWidgetError } from "../lib/widget-errors";

interface DashboardWidgetDataProps {
  dataPromise: Promise<
    | { data: TChartDataRow[]; query: TChartQuery; optionLabels?: Record<string, string> }
    | { error: TDashboardWidgetError }
  >;
  chartType: TChartType;
  view?: TWidgetView;
}

export function DashboardWidgetData({
  dataPromise,
  chartType,
  view = DEFAULT_WIDGET_VIEW,
}: Readonly<DashboardWidgetDataProps>) {
  const { t } = useTranslation();
  const result = use(dataPromise);

  if ("error" in result) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-red-500">
        {t("workspace.analysis.dashboards.failed_to_load_chart_data")}
      </div>
    );
  }

  // The data view reuses the chart builder's table, so the numbers behind a widget read the same
  // way in both places — bare, because the widget's own title bar and body already provide the
  // heading and the scroll container.
  if (view === "data") {
    return <DataViewer data={result.data} optionLabels={result.optionLabels} bare />;
  }

  // Use the resolved query + option labels from the promise (not the raw saved query): the label
  // lookup only fires when the x-axis dimension is the effective value_id dimension.
  return (
    <ChartRenderer
      chartType={chartType}
      data={result.data}
      query={result.query}
      optionLabels={result.optionLabels}
    />
  );
}
