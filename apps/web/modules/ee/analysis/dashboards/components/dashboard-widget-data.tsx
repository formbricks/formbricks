"use client";

import { use } from "react";
import { ChartRenderer } from "@/modules/ee/analysis/charts/components/chart-builder/chart-renderer";

interface DashboardWidgetDataProps {
  dataPromise: Promise<{ data: Record<string, unknown>[] } | { error: string }>;
  chartType: string;
}

export function DashboardWidgetData({ dataPromise, chartType }: Readonly<DashboardWidgetDataProps>) {
  const result = use(dataPromise);

  if ("error" in result) {
    return <div className="flex h-full items-center justify-center text-sm text-red-500">{result.error}</div>;
  }

  return <ChartRenderer chartType={chartType} data={result.data} />;
}
