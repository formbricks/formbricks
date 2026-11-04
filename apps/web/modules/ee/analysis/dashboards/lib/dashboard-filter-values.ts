import { type TChartDateRangeInput, listDashboardFilterValues } from "@/modules/ee/analysis/lib/api-client";
import { dashboardKeys } from "@/modules/ee/analysis/lib/query";
import type { TFilterProperty } from "@/modules/ui/components/table-toolbar/lib/types";
import type { TDashboardFilter, TDashboardFilterPicks } from "./dashboard-filters";

/**
 * A list dashboard filter as the shared value list takes it: the values the dashboard's charts let
 * through for the other picks and the date range, one search at a time. Each search is cached under
 * the chart data keys (`dashboardKeys.filterValues`), so editing a chart refreshes the list as it
 * refreshes the charts.
 */
export const getDashboardFilterValueProperty = ({
  dashboardId,
  filter,
  otherPicks,
  dateRange,
}: Readonly<{
  dashboardId: string;
  filter: TDashboardFilter;
  /** Every pick but this filter's own: they narrow which values it offers. */
  otherPicks: TDashboardFilterPicks;
  dateRange: TChartDateRangeInput | null;
}>): TFilterProperty => ({
  id: filter.id,
  label: filter.label,
  valueType: "enum",
  queryKey: (search) =>
    dashboardKeys.filterValues(dashboardId, filter.id, {
      dateRange,
      picks: otherPicks,
      search,
      field: filter.field,
      operator: filter.operator,
    }),
  loadOptions: async (search, signal) => {
    const { values, hasMore } = await listDashboardFilterValues({
      dashboardId,
      filterId: filter.id,
      dateRange: dateRange ?? undefined,
      picks: otherPicks,
      search: search || undefined,
      signal,
    });
    return { options: values.map(({ value }) => ({ value, label: value })), hasMore };
  },
});
