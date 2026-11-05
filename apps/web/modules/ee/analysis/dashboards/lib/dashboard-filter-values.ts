import { type TChartDateRangeInput, listDashboardFilterValues } from "@/modules/ee/analysis/lib/api-client";
import { dashboardKeys } from "@/modules/ee/analysis/lib/query";
import type {
  TAvailableValues,
  TFilterOption,
  TFilterProperty,
} from "@/modules/ui/components/table-toolbar/lib/types";
import type { TDashboardFilterState } from "./dashboard-filter-state";
import { NO_VALUE_PICK } from "./dashboard-filters";

type TValueListScope = Readonly<{
  dashboardId: string;
  field: string;
  /** Every filter but this field's own: they narrow which values it offers. */
  otherFilters: readonly TDashboardFilterState[];
  dateRange: TChartDateRangeInput | null;
}>;

/** Where one search of a field's value list is cached: under the chart data keys, so a chart edit refreshes it. */
const valueListKey = ({ dashboardId, field, otherFilters, dateRange }: TValueListScope, search: string) =>
  dashboardKeys.filterValues(dashboardId, {
    dateRange,
    filters: otherFilters,
    search,
    field,
    operator: "equals",
  });

/** Whether the "(No value)" option belongs in the list for a search: no search, or one its label holds. */
const matchesSearch = (option: TFilterOption, search: string): boolean =>
  !search || option.label.toLowerCase().includes(search.trim().toLowerCase());

/**
 * Whether a value list offers "(No value)". Unsearched, only beside at least one real value: when no record
 * on the charts has a value, every record matches "(No value)", so picking it would narrow nothing and the
 * list should read as empty instead. Searched, whenever the search names it.
 */
const offersNoValue = (noValueOption: TFilterOption, search: string, valueCount: number): boolean =>
  search.trim() ? matchesSearch(noValueOption, search) : valueCount > 0;

/**
 * A categorical field as the toolbar's value list takes it: the values the dashboard's charts let through
 * for the filters already applied and the date range, one search at a time, after the "(No value)" option
 * (`noValueOption`). Each search is cached under the chart data keys (`dashboardKeys.filterValues`), so
 * editing a chart refreshes the list as it refreshes the charts. The "(No value)" option is also the
 * property's one fixed option, so a chip names it.
 */
export const getDashboardFieldValueProperty = ({
  label,
  noValueOption,
  ...scope
}: TValueListScope &
  Readonly<{
    label: string;
    noValueOption: TFilterOption;
  }>): TFilterProperty => ({
  id: scope.field,
  label,
  valueType: "enum",
  options: [noValueOption],
  queryKey: (search) => valueListKey(scope, search),
  loadOptions: async (search, signal) => {
    const { values, hasMore } = await listDashboardFilterValues({
      dashboardId: scope.dashboardId,
      field: scope.field,
      operator: "equals",
      dateRange: scope.dateRange ?? undefined,
      filters: scope.otherFilters,
      search: search || undefined,
      signal,
    });
    return {
      options: [
        ...(offersNoValue(noValueOption, search, values.length) ? [noValueOption] : []),
        ...values.map(({ value }) => ({ value, label: value })),
      ],
      hasMore,
    };
  },
});

/**
 * Which of a fixed-option field's values (sentiment, value band, yes/no) occur on the dashboard's charts,
 * for the filters already applied and the date range: asked of the same value list, and cached beside it.
 * "(No value)" counts as occurring whenever any value does; with none at all the field shows `emptyHint`.
 */
export const getDashboardFieldAvailableValues = ({
  emptyHint,
  ...scope
}: TValueListScope & Readonly<{ emptyHint: string }>): TAvailableValues => ({
  queryKey: [...valueListKey(scope, ""), "available"],
  emptyHint,
  load: async (signal) => {
    const { values } = await listDashboardFilterValues({
      dashboardId: scope.dashboardId,
      field: scope.field,
      operator: "equals",
      dateRange: scope.dateRange ?? undefined,
      filters: scope.otherFilters,
      signal,
    });
    return values.length > 0 ? [...values.map(({ value }) => value), NO_VALUE_PICK] : [];
  },
});
