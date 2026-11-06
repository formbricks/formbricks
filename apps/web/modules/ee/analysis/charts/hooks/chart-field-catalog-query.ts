import { getChartFieldCatalog } from "@/modules/ee/analysis/lib/api-client";

/**
 * How long the app reuses a dataset's field catalog before reading it again. The server answers from its
 * own cached key list, so a shorter reuse here only costs a cheap read.
 */
const CHART_FIELD_CATALOG_STALE_MS = 5 * 60 * 1000;

/**
 * The one query for a Feedback Dataset's field catalog, shared by the chart builder and the dashboard
 * filter editor so both read the same cache entry.
 */
export const chartFieldCatalogQuery = (workspaceId: string, datasetId: string, enabled = true) => ({
  queryKey: ["chartFieldCatalog", workspaceId, datasetId] as const,
  queryFn: ({ signal }: { signal: AbortSignal }) => getChartFieldCatalog({ workspaceId, datasetId, signal }),
  enabled: enabled && datasetId.length > 0,
  staleTime: CHART_FIELD_CATALOG_STALE_MS,
});

/** Whether a dataset's extra fields are still loading or failed, and how to try again. */
export type TDatasetFieldsStatus = {
  isLoading: boolean;
  error: unknown;
  retry: () => void;
};
