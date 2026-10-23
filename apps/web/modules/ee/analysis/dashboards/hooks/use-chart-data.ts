"use client";

import { useQuery } from "@tanstack/react-query";
import { retryUnlessClientError } from "@/modules/api/lib/v3-client";
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
    // A failure here is one widget's; retrying it once is enough before its error shows, and a 4xx
    // (a chart query the validator refuses, a chart the caller may not read) is not retried at all.
    retry: retryUnlessClientError(1),
  });
