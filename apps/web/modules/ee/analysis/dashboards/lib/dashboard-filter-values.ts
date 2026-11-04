import { type TChartDateRangeInput, listDashboardFilterValues } from "@/modules/ee/analysis/lib/api-client";
import { dashboardKeys } from "@/modules/ee/analysis/lib/query";
import type { TFilterProperty } from "@/modules/ui/components/table-toolbar/lib/types";
import type { TDashboardFilterState } from "./dashboard-filter-state";

/**
 * A categorical field as the toolbar's value list takes it: the values the dashboard's charts let through
 * for the filters already applied and the date range, one search at a time. Each search is cached under the
 * chart data keys (`dashboardKeys.filterValues`), so editing a chart refreshes the list as it refreshes
 * the charts.
 */
export const getDashboardFieldValueProperty = ({
  dashboardId,
  field,
  label,
  otherFilters,
  dateRange,
}: Readonly<{
  dashboardId: string;
  field: string;
  label: string;
  /** Every filter but this field's own: they narrow which values it offers. */
  otherFilters: readonly TDashboardFilterState[];
  dateRange: TChartDateRangeInput | null;
}>): TFilterProperty => ({
  id: field,
  label,
  valueType: "enum",
  queryKey: (search) =>
    dashboardKeys.filterValues(dashboardId, {
      dateRange,
      filters: otherFilters,
      search,
      field,
      operator: "equals",
    }),
  loadOptions: async (search, signal) => {
    const { values, hasMore } = await listDashboardFilterValues({
      dashboardId,
      field,
      operator: "equals",
      dateRange: dateRange ?? undefined,
      filters: otherFilters,
      search: search || undefined,
      signal,
    });
    return { options: values.map(({ value }) => ({ value, label: value })), hasMore };
  },
});
