"use client";

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { getChartFieldCatalog } from "@/modules/ee/analysis/lib/api-client";
import { isEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-data-fields";
import type { TEmbeddedChartField } from "@/modules/ee/analysis/lib/field-catalog";

/** How long a dataset's fields are reused: the server refreshes its key list every 15 minutes. */
const DATASET_FIELDS_STALE_MS = 5 * 60 * 1000;

/** One field per embedded member, named by its key, in key order. */
export const mergeEmbeddedFields = (
  catalogs: ReadonlyArray<ReadonlyArray<{ name: string; label: string }>>
): TEmbeddedChartField[] => {
  const byName = new Map<string, TEmbeddedChartField>();
  for (const fields of catalogs) {
    for (const field of fields) {
      if (isEmbeddedMemberName(field.name) && !byName.has(field.name)) {
        byName.set(field.name, { name: field.name, key: field.label });
      }
    }
  }
  return [...byName.values()].sort((a, b) => a.key.localeCompare(b.key));
};

/**
 * The embedded-data fields a dashboard filter can offer (ENG-6893): every key of every Feedback Dataset
 * the dashboard's charts read, once each, read off each dataset's field catalog with the chart builder's
 * own query key so the two share the cache. A key in several datasets is one field: its member name is
 * the same in each. Empty until loaded, or while `enabled` is off (outside edit mode).
 */
export const useDashboardEmbeddedFields = (
  workspaceId: string,
  datasetIds: readonly string[],
  enabled: boolean
): TEmbeddedChartField[] => {
  const uniqueIds = useMemo(() => [...new Set(datasetIds)].sort(), [datasetIds]);
  return useQueries({
    queries: uniqueIds.map((datasetId) => ({
      queryKey: ["chartFieldCatalog", workspaceId, datasetId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getChartFieldCatalog({ workspaceId, datasetId, signal }),
      enabled,
      staleTime: DATASET_FIELDS_STALE_MS,
    })),
    combine: (results) => mergeEmbeddedFields(results.map(({ data }) => data?.fields ?? [])),
  });
};
