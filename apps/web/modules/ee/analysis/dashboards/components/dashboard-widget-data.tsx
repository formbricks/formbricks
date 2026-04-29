"use client";

import { use } from "react";
import { useTranslation } from "react-i18next";
import { TChartQuery } from "@formbricks/types/analysis";
import { ChartRenderer } from "@/modules/ee/analysis/charts/components/chart-renderer";
import type { TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";
import { DASHBOARD_WIDGET_LOAD_ERROR, type TDashboardWidgetError } from "../lib/widget-errors";

interface DashboardWidgetDataProps {
  dataPromise: Promise<{ data: TChartDataRow[] } | { error: TDashboardWidgetError }>;
  chartType: TChartType;
  query: TChartQuery;
}

export function DashboardWidgetData({ dataPromise, chartType, query }: Readonly<DashboardWidgetDataProps>) {
  const { t } = useTranslation();
  const result = use(dataPromise);

  if ("error" in result) {
    const errorMessage =
      result.error === DASHBOARD_WIDGET_LOAD_ERROR
        ? t("workspace.analysis.dashboards.failed_to_load_chart_data")
        : t("workspace.analysis.dashboards.failed_to_load_chart_data");

    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-red-500">
        {errorMessage}
      </div>
    );
  }

  return <ChartRenderer chartType={chartType} data={result.data} query={query} />;
}
