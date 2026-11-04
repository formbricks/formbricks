import type { TChartQuery, TCubeFilter, TMemberFilter } from "@formbricks/types/analysis";
import { MAX_ANSWER_RULES, countAnswerRules } from "@/modules/ee/analysis/lib/answer-filter";
import { getChartField } from "@/modules/ee/analysis/lib/field-catalog";
import {
  type TDashboardDateFilter,
  type TDateClock,
  applyDashboardDateFilter,
  toDateRangeRule,
} from "./dashboard-date-filter";
import { resolvePicksForDataset } from "./dashboard-filter-picks";
import type { TDashboardFilter, TDashboardFilterPicks } from "./dashboard-filters";

/**
 * A list dashboard filter's values (ENG-6892, ENG-6895): the values the dashboard's charts let through
 * under their own saved filters, with the dashboard's date range in place of their saved one, narrowed by
 * the other filters' picks — never by the filter's own pick.
 *
 * One query per Feedback Dataset that has the field. Its filter is the OR of the dataset's distinct chart
 * rule sets, each branch keeping its chart's whole rule set as the dashboard runs it (the dashboard's date
 * range in place of the saved one), ANDed with the other picks. Merging field by field instead leaked values no chart lets through (ENG-6895):
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

/**
 * The rule sets cut into runs whose answer rules fit one query (`MAX_ANSWER_RULES`), in order: each run is
 * one value query, so an OR of several charts' answer rules never exceeds what one query may hold. A rule
 * set over the cap on its own is left out — its chart is refused when it runs, so it shows no value.
 */
const chunkByAnswerRules = (ruleSets: readonly TCubeFilter[][]): TCubeFilter[][][] => {
  const chunks: TCubeFilter[][][] = [];
  let current: TCubeFilter[][] = [];
  let answers = 0;
  for (const rules of ruleSets) {
    const count = countAnswerRules(rules);
    if (count > MAX_ANSWER_RULES) continue;
    if (current.length > 0 && answers + count > MAX_ANSWER_RULES) {
      chunks.push(current);
      current = [];
      answers = 0;
    }
    current.push(rules);
    answers += count;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
};

/** One rule standing for a branch: its rule, or the AND of its rules. */
const asOneRule = (rules: TCubeFilter[]): TCubeFilter => (rules.length === 1 ? rules[0] : { and: rules });

/** The rules every value query ends with: the field has a value, containing `search` when given. */
const valueRulesOf = (filter: TDashboardFilter, search?: string): TCubeFilter[] => [
  { member: filter.field, operator: "set" },
  ...(search ? [{ member: filter.field, operator: "contains", values: [search] }] : []),
];

/**
 * The Cube queries for one list filter's values: one per Feedback Dataset that has the field, over its
 * charts that are not bounded by their own groups (`isGroupBoundedChart`; those take two steps, below).
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
  const valueRules = valueRulesOf(filter, search);

  const toQuery = (datasetId: string, scope: TCubeFilter[], narrowing: TCubeFilter[]): TFilterValueQuery => ({
    datasetId,
    query: {
      dimensions: [filter.field],
      filters: [...scope, ...narrowing, ...valueRules],
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
      if (chart.datasetId !== datasetId || isGroupBoundedChart(chart.query)) continue;
      const rules = chartRuleSet(applyDashboardDateFilter(chart.query, dateFilter), clock);
      branches.set(JSON.stringify(rules), rules);
    }

    const ruleSets = [...branches.values()].filter((rules) => countAnswerRules(rules) <= MAX_ANSWER_RULES);
    if (ruleSets.length === 0) return [];
    // A chart without saved rules lets every record through, so the OR of all branches is no narrowing.
    if (ruleSets.some((rules) => rules.length === 0)) return [toQuery(datasetId, [], otherPicks.rules)];

    return chunkByAnswerRules(ruleSets).map((chunk) =>
      toQuery(datasetId, chunk.length === 1 ? chunk[0] : [{ or: chunk.map(asOneRule) }], otherPicks.rules)
    );
  });
};

/**
 * Whether a chart shows only some of the records its rules let through, picked per group (S6): a top-N
 * (`limit`, `offset`) keeps the first groups, and a rule on a measure (HAVING) keeps the groups whose
 * measure passes. Such a chart's values cannot be merged into a rule set: a value from a group the chart
 * does not show would be listed, and a measure rule on the value query would be judged per value instead of
 * per the chart's own group. Its values are bounded by its own groups (`buildBoundedChartQueries`).
 */
export const isGroupBoundedChart = (query: TChartQuery): boolean =>
  query.limit !== undefined || query.offset !== undefined || refersToMeasure(query.filters ?? []);

/**
 * Most groups of a bounded chart its values are looked up within: each group is one branch of an OR in
 * the value query. A chart showing more (or grouped by time, whose buckets are not values to match) is
 * left out as a value source — a shorter list, never a value the chart does not show.
 */
export const FILTER_VALUE_GROUP_LIMIT = 100;

/**
 * A bounded chart's own query — as the dashboard shows it under the other picks and the dashboard date —
 * and the record-level rules its groups are drawn from (`scope`: its non-measure rules, its date range as
 * the dashboard runs it, and the other picks).
 */
export type TFilterValueGroupQuery = { datasetId: string; query: TChartQuery; scope: TCubeFilter[] };

const isRecordRule = (rule: TCubeFilter): boolean => !refersToMeasure([rule]);

/**
 * The first step for the bounded charts (S6): each one's own query, to learn which groups it shows. Charts
 * whose dataset lacks the field, or another picked filter's field, show nothing and are left out.
 */
export const buildBoundedChartQueries = ({
  filter,
  filters,
  charts,
  picks,
  dateFilter,
  clock,
  datasetHasField,
}: Omit<Parameters<typeof buildFilterValueQueries>[0], "search">): TFilterValueGroupQuery[] => {
  return charts.flatMap((chart) => {
    if (!isGroupBoundedChart(chart.query)) return [];
    // A chart over the answer-rule cap is refused when it runs, so it shows no value.
    if (countAnswerRules(chart.query.filters) > MAX_ANSWER_RULES) return [];
    const hasField = (field: string) => datasetHasField(chart.datasetId, field);
    if (!hasField(filter.field)) return [];
    const otherPicks = resolvePicksForDataset(filters, picks, hasField, { except: filter.id });
    if (otherPicks.unfilterable.length > 0) return [];

    const query = applyDashboardDateFilter(chart.query, dateFilter);
    return [
      {
        datasetId: chart.datasetId,
        query: { ...query, filters: [...(query.filters ?? []), ...otherPicks.rules] },
        scope: [...chartRuleSet(query, clock).filter(isRecordRule), ...otherPicks.rules],
      },
    ];
  });
};

export type TBoundedChartValues =
  | { type: "values"; values: string[] }
  | { type: "query"; query: TFilterValueQuery }
  | { type: "none" };

/**
 * The second step for one bounded chart, from the rows its own query returned. When the chart is grouped by
 * the filter's field, its rows are the values. Otherwise the values are looked up among the records of the
 * groups it shows — one OR branch per group — and a chart grouped by time, or showing more than
 * `FILTER_VALUE_GROUP_LIMIT` groups, offers none.
 */
export const resolveBoundedChartValues = ({
  filter,
  group,
  rows,
  search,
}: {
  filter: TDashboardFilter;
  group: TFilterValueGroupQuery;
  rows: readonly unknown[];
  search?: string;
}): TBoundedChartValues => {
  if (rows.length === 0) return { type: "none" };
  const dimensions = group.query.dimensions ?? [];

  if (dimensions.includes(filter.field)) {
    const needle = search?.toLowerCase();
    const values = rows.flatMap((row) => {
      const value = (row as Record<string, unknown>)[filter.field];
      if (typeof value !== "string" || value === "") return [];
      return needle && !value.toLowerCase().includes(needle) ? [] : [value];
    });
    return { type: "values", values };
  }

  const groupedByTime = (group.query.timeDimensions ?? []).some((td) => td.granularity !== undefined);
  if (groupedByTime || rows.length > FILTER_VALUE_GROUP_LIMIT) return { type: "none" };

  const groupRules: TCubeFilter[] =
    dimensions.length === 0
      ? []
      : [
          {
            or: rows.map((row) =>
              asOneRule(
                dimensions.map((dimension): TCubeFilter => {
                  const value = (row as Record<string, unknown>)[dimension];
                  // Cube returns a dimension's value as a string, number or boolean; anything else is a
                  // value this row cannot be pinned to, so it reads as not set.
                  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
                    ? { member: dimension, operator: "equals", values: [String(value)] }
                    : { member: dimension, operator: "notSet" };
                })
              )
            ),
          },
        ];

  return {
    type: "query",
    query: {
      datasetId: group.datasetId,
      query: {
        dimensions: [filter.field],
        filters: [...group.scope, ...groupRules, ...valueRulesOf(filter, search)],
        order: [[filter.field, "asc"]],
        limit: FILTER_VALUE_LIST_LIMIT + 1,
      },
    },
  };
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
