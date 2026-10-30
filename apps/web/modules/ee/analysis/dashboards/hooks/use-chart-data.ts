"use client";

import { useQuery } from "@tanstack/react-query";
import { retryUnlessClientError } from "@/modules/api/lib/v3-client";
import { type TChartDateRangeInput, getChartData } from "@/modules/ee/analysis/lib/api-client";
import { chartKeys } from "@/modules/ee/analysis/lib/query";
import { takeChartDataTurn } from "../lib/chart-data-queue";

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
    // In turns, so a large dashboard never asks for more than the server runs at once for one user.
    queryFn: ({ signal }) =>
      takeChartDataTurn(signal, () => getChartData({ chartId, dateRange: dateRange ?? undefined, signal })),
    // A failure here is one widget's; retrying it once is enough before its error shows, and a 4xx
    // (a chart query the validator refuses, a chart the caller may not read) is not retried at all —
    // except a brief 429, which waits for one of the caller's chart query slots to free up (the
    // house query client's `v3RetryDelay` waits out its Retry-After).
    retry: retryUnlessClientError(1),
  });
