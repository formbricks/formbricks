"use client";

import { useQuery } from "@tanstack/react-query";
import { type TChartDateRangeInput, getChartData } from "@/modules/ee/analysis/lib/api-client";
import { chartKeys } from "@/modules/ee/analysis/lib/query";

/**
 * One widget's data. Each widget asks on its own, so a slow or failing chart never holds up the rest
 * of the dashboard; the dashboard's date range replaces the chart's own.
 */
export const useChartData = ({
  chartId,
  dateRange,
}: Readonly<{ chartId: string; dateRange: TChartDateRangeInput | null }>) =>
  useQuery({
    queryKey: chartKeys.data(chartId, dateRange),
    queryFn: ({ signal }) => getChartData({ chartId, dateRange: dateRange ?? undefined, signal }),
    // A failure here is one widget's; retrying it once is enough before its error shows.
    retry: 1,
  });
