import type { TChartQuery, TCubeFilter, TMemberFilter } from "@formbricks/types/analysis";
import { getChartField } from "@/modules/ee/analysis/lib/field-catalog";
import {
  COLLECTED_AT_DIMENSION,
  type TDashboardDateFilter,
  type TDateClock,
  toDateRangeRule,
} from "./dashboard-date-filter";
import { resolvePicksForDataset } from "./dashboard-filter-picks";
import type { TDashboardFilter, TDashboardFilterPicks } from "./dashboard-filters";

/**
 * A list dashboard filter's values (ENG-6892, ENG-6895): the values the dashboard's charts let through
 * under their own saved filters and date ranges, narrowed by the dashboard date and the other filters'
 * picks — never by the filter's own pick.
 *
 * One query per Feedback Dataset that has the field. Its filter is the OR of the dataset's distinct chart
 * rule sets, each branch keeping its chart's whole rule set and saved date range, ANDed with the dashboard
 * date and the other picks. Merging field by field instead leaked values no chart lets through (ENG-6895):
 * a value allowed by one chart's product rule and another chart's region rule is let through by neither.
 */

/** Most values a list shows; one more is fetched to know whether there are more. */
export const FILTER_VALUE_LIST_LIMIT = 100;

export type TFilterValueChart = { datasetId: string; query: TChartQuery };

export type TFilterValueQuery = { datasetId: string; query: TChartQuery };

/** Whether a rule set refers to a measure: such a rule is a condition on each query's own groups. */
const refersToMeasure = (rules: readonly TCubeFilter[]): boolean =>
  rules.some((rule) =>
    "member" in rule ? getChartField(rule.member)?.kind === "measure" : refersToMeasure(rulesOf(rule))
  );

const rulesOf = (group: Exclude<TCubeFilter, TMemberFilter>): TCubeFilter[] =>
  "and" in group ? group.and : group.or;

/**
 * What a saved chart lets through: its saved filters, and its saved date range on every time dimension that
 * has one, written out as explicit days so they mean what the chart means by them.
 */
export const chartRuleSet = (query: TChartQuery, clock: TDateClock): TCubeFilter[] => [
  ...(query.filters ?? []),
  ...(query.timeDimensions ?? []).flatMap((timeDimension) =>
    timeDimension.dateRange === undefined
      ? []
      : [toDateRangeRule(timeDimension.dimension, timeDimension.dateRange, clock)]
  ),
];

/** One rule standing for a branch: its rule, or the AND of its rules. */
const asOneRule = (rules: TCubeFilter[]): TCubeFilter => (rules.length === 1 ? rules[0] : { and: rules });

/**
 * The Cube queries for one list filter's values: one per Feedback Dataset that has the field, plus one per
 * chart whose saved rules refer to a measure, which cannot sit in an OR beside the others.
 *
 * A dataset is left out when its charts cannot let anything through: it lacks the field, or another picked
 * filter's field, which leaves its charts empty.
 */
export const buildFilterValueQueries = ({
  filter,
  filters,
  charts,
  picks,
  dateFilter,
  clock,
  datasetHasField,
  search,
}: {
  filter: TDashboardFilter;
  filters: readonly TDashboardFilter[];
  charts: readonly TFilterValueChart[];
  picks: TDashboardFilterPicks;
  dateFilter: TDashboardDateFilter | null;
  clock: TDateClock;
  datasetHasField: (datasetId: string, field: string) => boolean;
  search?: string;
}): TFilterValueQuery[] => {
  const dashboardDate: TCubeFilter[] =
    dateFilter && dateFilter.type !== "all-time"
      ? [
          toDateRangeRule(
            COLLECTED_AT_DIMENSION,
            dateFilter.type === "preset" ? dateFilter.value : dateFilter.range,
            clock
          ),
        ]
      : [];
  const valueRules: TCubeFilter[] = [
    { member: filter.field, operator: "set" },
    ...(search ? [{ member: filter.field, operator: "contains", values: [search] }] : []),
  ];

  const toQuery = (datasetId: string, scope: TCubeFilter[], narrowing: TCubeFilter[]): TFilterValueQuery => ({
    datasetId,
    query: {
      dimensions: [filter.field],
      filters: [...scope, ...narrowing, ...dashboardDate, ...valueRules],
      order: [[filter.field, "asc"]],
      limit: FILTER_VALUE_LIST_LIMIT + 1,
    },
  });

  const datasetIds = [...new Set(charts.map((chart) => chart.datasetId))];
  return datasetIds.flatMap((datasetId) => {
    const hasField = (field: string) => datasetHasField(datasetId, field);
    if (!hasField(filter.field)) return [];

    const otherPicks = resolvePicksForDataset(filters, picks, hasField, { except: filter.id });
    if (otherPicks.unfilterable.length > 0) return [];

    // Charts with the same saved rules let the same values through: one branch for each distinct set.
    const branches = new Map<string, TCubeFilter[]>();
    for (const chart of charts) {
      if (chart.datasetId !== datasetId) continue;
      const rules = chartRuleSet(chart.query, clock);
      branches.set(JSON.stringify(rules), rules);
    }

    const ruleSets = [...branches.values()];
    // A chart without saved rules lets every record through, so the OR of all branches is no narrowing.
    if (ruleSets.some((rules) => rules.length === 0)) return [toQuery(datasetId, [], otherPicks.rules)];

    const merged = ruleSets.filter((rules) => !refersToMeasure(rules));
    const separate = ruleSets.filter(refersToMeasure);
    return [
      ...(merged.length > 0
        ? [
            toQuery(
              datasetId,
              merged.length === 1 ? merged[0] : [{ or: merged.map(asOneRule) }],
              otherPicks.rules
            ),
          ]
        : []),
      ...separate.map((rules) => toQuery(datasetId, rules, otherPicks.rules)),
    ];
  });
};

/**
 * Merge the queries' rows into one list: distinct values, in order, cut at `FILTER_VALUE_LIST_LIMIT`.
 * `hasMore` when more values match than are shown: the cut dropped one, or a query hit its own limit.
 */
export const mergeFilterValues = (
  field: string,
  results: readonly unknown[][]
): { values: { value: string }[]; hasMore: boolean } => {
  const distinct = new Set<string>();
  let truncated = false;
  for (const rows of results) {
    if (rows.length > FILTER_VALUE_LIST_LIMIT) truncated = true;
    for (const row of rows) {
      const value = (row as Record<string, unknown>)[field];
      if (typeof value === "string" && value !== "") distinct.add(value);
    }
  }

  const ordered = [...distinct];
  // One dataset's values already come in Cube's order; values from several are merged alphabetically.
  if (results.length > 1) ordered.sort((a, b) => a.localeCompare(b));

  return {
    values: ordered.slice(0, FILTER_VALUE_LIST_LIMIT).map((value) => ({ value })),
    hasMore: truncated || ordered.length > FILTER_VALUE_LIST_LIMIT,
  };
};
