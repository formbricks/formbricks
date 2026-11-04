"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TChartDateRangeInput } from "@/modules/ee/analysis/lib/api-client";
import type { TFilterProperty, TTableFilter } from "@/modules/ui/components/table-toolbar/lib/types";
import type { TDashboardFilterState } from "../lib/dashboard-filter-state";
import {
  buildToolbarProperties,
  fromToolbarFilters,
  toToolbarFilters,
} from "../lib/dashboard-toolbar-filters";
import { useDashboardEmbeddedFields } from "./use-dashboard-embedded-fields";

/**
 * A dashboard's filters for the table toolbar: its properties (the charts' datasets' dimensions and
 * embedded-data keys), the filters as the toolbar holds them, and how a change reaches the dashboard.
 */
export const useDashboardToolbarFilters = ({
  workspaceId,
  dashboardId,
  datasetIds,
  filters,
  dateRange,
  onFiltersChange,
}: Readonly<{
  workspaceId: string;
  dashboardId: string;
  datasetIds: readonly string[];
  filters: readonly TDashboardFilterState[];
  dateRange: TChartDateRangeInput | null;
  onFiltersChange: (filters: TDashboardFilterState[]) => void;
}>) => {
  const { t } = useTranslation();
  const fields = useDashboardEmbeddedFields(workspaceId, datasetIds, true);
  const properties = useMemo(
    () =>
      buildToolbarProperties({ t, embeddedFields: fields.embeddedFields, dashboardId, filters, dateRange }),
    [t, fields.embeddedFields, dashboardId, filters, dateRange]
  );
  const toolbarFilters = useMemo(() => toToolbarFilters(filters), [filters]);
  const labelOf = useMemo(() => {
    const labels = new Map<string, string>(
      properties.map((property: TFilterProperty) => [property.id, property.label])
    );
    return (field: string) => labels.get(field) ?? field;
  }, [properties]);

  return {
    properties,
    filters: toolbarFilters,
    setFilters: (next: TTableFilter[]) => onFiltersChange(fromToolbarFilters(next)),
    fieldLabel: labelOf,
  };
};
