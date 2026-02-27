"use client";

import { use } from "react";
import { useTranslation } from "react-i18next";
import { TChartQuery } from "@formbricks/types/analysis";
import { ChartRenderer } from "@/modules/ee/analysis/charts/components/chart-renderer";
import type { TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";

interface DashboardWidgetDataProps {
  dataPromise: Promise<{ data: TChartDataRow[] } | { error: string }>;
  chartType: TChartType;
  query: TChartQuery;
}

export function DashboardWidgetData({ dataPromise, chartType, query }: Readonly<DashboardWidgetDataProps>) {
  const { t } = useTranslation();
  const result = use(dataPromise);

  if ("error" in result) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-500">
        {t("environments.analysis.dashboards.failed_to_load_chart_data")}
      </div>
    );
  }

  return <ChartRenderer chartType={chartType} data={result.data} query={query} />;
}
