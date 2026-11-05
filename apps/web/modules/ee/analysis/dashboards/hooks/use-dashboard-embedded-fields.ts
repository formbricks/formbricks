"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { TDatasetFieldsStatus } from "@/modules/ee/analysis/charts/hooks/chart-field-catalog-query";
import { listDashboardFilterFields } from "@/modules/ee/analysis/lib/api-client";
import type { TEmbeddedChartField } from "@/modules/ee/analysis/lib/field-catalog";
import { dashboardKeys } from "@/modules/ee/analysis/lib/query";

export type TDashboardEmbeddedFields = TDatasetFieldsStatus & { embeddedFields: TEmbeddedChartField[] };

/** How long the app reuses a dashboard's filter fields; the server answers from its own cached key lists. */
const FILTER_FIELDS_STALE_MS = 5 * 60 * 1000;

const NO_FIELDS: TEmbeddedChartField[] = [];

/**
 * The embedded-data fields a dashboard filter can offer: every key of every Feedback Dataset the
 * dashboard's charts read, once each, from the dashboard-bound `GET /api/v3/dashboards/{id}/filter-fields`
 * — so a Dashboard viewer, whom the field catalog refuses, gets them too. `datasetIds` are the charts'
 * datasets: a change to them reads the fields again. Empty until loaded, or while `enabled` is off.
 */
export const useDashboardEmbeddedFields = ({
  dashboardId,
  datasetIds,
  enabled = true,
}: Readonly<{
  dashboardId: string;
  datasetIds: readonly string[];
  enabled?: boolean;
}>): TDashboardEmbeddedFields => {
  const uniqueIds = useMemo(() => [...new Set(datasetIds)].sort((a, b) => a.localeCompare(b)), [datasetIds]);
  const query = useQuery({
    queryKey: dashboardKeys.filterFields(dashboardId, uniqueIds),
    queryFn: ({ signal }) => listDashboardFilterFields(dashboardId, signal),
    // A dashboard without charts has no dataset to offer keys from.
    enabled: enabled && dashboardId.length > 0 && uniqueIds.length > 0,
    staleTime: FILTER_FIELDS_STALE_MS,
    select: (data): TEmbeddedChartField[] => data.fields.map(({ name, key }) => ({ name, key })),
  });
  const { refetch } = query;
  return {
    embeddedFields: query.data ?? NO_FIELDS,
    isLoading: query.isLoading,
    error: query.error ?? null,
    retry: () => void refetch(),
  };
};
