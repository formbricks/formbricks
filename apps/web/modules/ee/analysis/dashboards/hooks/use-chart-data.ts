"use client";

import { useQuery } from "@tanstack/react-query";
import { retryUnlessClientError } from "@/modules/api/lib/v3-client";
import { type TChartDateRangeInput, getDashboardChartData } from "@/modules/ee/analysis/lib/api-client";
import { chartKeys } from "@/modules/ee/analysis/lib/query";
import { takeChartDataTurn } from "../lib/chart-data-queue";
import type { TDashboardFilterPicks } from "../lib/dashboard-filters";

/**
 * One widget's data, read through its dashboard. Each widget asks on its own, so a slow or failing chart
 * never holds up the rest of the dashboard; the dashboard's date range and the person's filter picks
 * narrow the chart's saved query (ADR-0019).
 */
export const useChartData = ({
  dashboardId,
  chartId,
  dateRange,
  picks,
}: Readonly<{
  dashboardId: string;
  chartId: string;
  dateRange: TChartDateRangeInput | null;
  picks: TDashboardFilterPicks;
}>) =>
  useQuery({
    queryKey: chartKeys.dashboardData(dashboardId, chartId, dateRange, picks),
    // In turns, so a large dashboard never asks for more than the server runs at once for one user.
    queryFn: ({ signal }) =>
      takeChartDataTurn(signal, () =>
        getDashboardChartData({ dashboardId, chartId, dateRange: dateRange ?? undefined, picks, signal })
      ),
    // A failure here is one widget's; retrying it once is enough before its error shows, and a 4xx
    // (a chart query the validator refuses, a chart the caller may not read) is not retried at all —
    // except a brief 429, which waits for one of the caller's chart query slots to free up (the
    // analysis query client's `v3RetryDelay` waits out its Retry-After).
    retry: retryUnlessClientError(1),
  });
