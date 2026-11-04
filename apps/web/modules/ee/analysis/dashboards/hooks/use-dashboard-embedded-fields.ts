"use client";

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  type TDatasetFieldsStatus,
  chartFieldCatalogQuery,
} from "@/modules/ee/analysis/charts/hooks/chart-field-catalog-query";
import { mergeEmbeddedFields } from "@/modules/ee/analysis/charts/lib/catalog-embedded-fields";
import type { TEmbeddedChartField } from "@/modules/ee/analysis/lib/field-catalog";

export type TDashboardEmbeddedFields = TDatasetFieldsStatus & { embeddedFields: TEmbeddedChartField[] };

/**
 * The embedded-data fields a dashboard filter can offer: every key of every Feedback Dataset
 * the dashboard's charts read, once each, read off each dataset's field catalog with the chart builder's
 * own query so the two share the cache. Empty until loaded, or while `enabled` is off (outside edit mode).
 */
export const useDashboardEmbeddedFields = (
  workspaceId: string,
  datasetIds: readonly string[],
  enabled: boolean
): TDashboardEmbeddedFields => {
  const uniqueIds = useMemo(() => [...new Set(datasetIds)].sort((a, b) => a.localeCompare(b)), [datasetIds]);
  return useQueries({
    queries: uniqueIds.map((datasetId) => chartFieldCatalogQuery(workspaceId, datasetId, enabled)),
    combine: (results) => ({
      embeddedFields: mergeEmbeddedFields(results.map(({ data }) => data?.fields ?? [])),
      isLoading: results.some((result) => result.isLoading),
      error: results.find((result) => result.error)?.error ?? null,
      retry: () => {
        for (const result of results) if (result.error) void result.refetch();
      },
    }),
  });
};
