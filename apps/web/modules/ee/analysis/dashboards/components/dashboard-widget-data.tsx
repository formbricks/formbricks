"use client";

import { use } from "react";
import { useTranslation } from "react-i18next";
import { TChartQuery } from "@formbricks/types/analysis";
import { ChartRenderer } from "@/modules/ee/analysis/charts/components/chart-renderer";
import type { TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";
import { DASHBOARD_WIDGET_DATASET_UNAVAILABLE, type TDashboardWidgetError } from "../lib/widget-errors";

interface DashboardWidgetDataProps {
  dataPromise: Promise<{ data: TChartDataRow[] } | { error: TDashboardWidgetError }>;
  chartType: TChartType;
  query: TChartQuery;
}

export function DashboardWidgetData({ dataPromise, chartType, query }: Readonly<DashboardWidgetDataProps>) {
  const { t } = useTranslation();
  const result = use(dataPromise);

  if ("error" in result) {
    // The dataset a widget points at can be archived, deleted, or unassigned from this
    // workspace. That is an expected state (not a failure), so render a neutral panel
    // instead of the red error UI reserved for genuine load failures.
    if (result.error === DASHBOARD_WIDGET_DATASET_UNAVAILABLE) {
      return (
        <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
          {t("workspace.analysis.dashboards.widget_dataset_unavailable")}
        </div>
      );
    }

    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-red-500">
        {t("workspace.analysis.dashboards.failed_to_load_chart_data")}
      </div>
    );
  }

  return <ChartRenderer chartType={chartType} data={result.data} query={query} />;
}
