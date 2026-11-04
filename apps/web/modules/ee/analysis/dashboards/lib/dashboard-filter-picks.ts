import type { TChartQuery, TCubeFilter, TMemberFilter } from "@formbricks/types/analysis";
import { filterRuleIdOf } from "./dashboard-filter-rules";
import {
  type TDashboardFilter,
  type TDashboardFilterPicks,
  getDashboardFilterField,
  isListDashboardFilter,
  parseStoredDashboardFilters,
} from "./dashboard-filters";

/**
 * How a person's dashboard filter picks reach a chart query (ADR-0024). Pure functions over the Cube query
 * JSON, so any field the catalog lists — embedded-data members included — narrows the same way.
 */

/**
 * The most characters a person's picks may take in a URL, summed over every value of every filter, each
 * counted percent-encoded as a GET carries it (`countPickChars`). Each value may be up to 1000 characters
 * and a list pick up to 100 values, so without a total the picks of 10 filters could reach megabytes in a
 * query string; 4000 encoded characters, plus the filter ids, keep every read's URL inside the 8 KB header
 * buffers common proxies use. The API answers 422 past it, and the dashboard page stops adding values.
 */
export const MAX_DASHBOARD_FILTER_PICKS_CHARS = 4000;

/** A value's length percent-encoded: a character outside ASCII takes up to 12, a space 3. */
const encodedLength = (value: string): number => {
  try {
    return encodeURIComponent(value).length;
  } catch {
    // A lone surrogate cannot be encoded; count it as the widest a character can be.
    return value.length * 12;
  }
};

/** How many characters a set of picks takes in a URL, summed over every value, each percent-encoded. */
export const countPickChars = (picks: TDashboardFilterPicks): number =>
  Object.values(picks).reduce(
    (total, values) => total + values.reduce((sum, value) => sum + encodedLength(value), 0),
    0
  );

/** Whether picks hold more than `MAX_DASHBOARD_FILTER_PICKS_CHARS`. */
export const exceedsPicksBudget = (picks: TDashboardFilterPicks): boolean =>
  countPickChars(picks) > MAX_DASHBOARD_FILTER_PICKS_CHARS;

/** A problem with a person's picks, shaped as a v3 `invalid_params` entry. */
export type TPickIssue = { name: string; reason: string; code?: "limit_exceeded" };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** Why a picked value cannot be compared with the field, or `null` when it can. */
const pickValueProblem = (type: string | undefined, value: string): string | null => {
  if (type === "number") {
    return value.trim() !== "" && Number.isFinite(Number(value)) ? null : "Must be a number.";
  }
  if (type === "time") {
    return ISO_DATE.test(value) && !Number.isNaN(Date.parse(value))
      ? null
      : "Must be a date (YYYY-MM-DD or an ISO 8601 timestamp).";
  }
  if (type === "boolean") return value === "true" || value === "false" ? null : "Must be true or false.";
  return null;
};

/**
 * What is wrong with a person's picks before any of them reaches a chart query: more characters
 * in all than `MAX_DASHBOARD_FILTER_PICKS_CHARS`, or a value a filter's field cannot hold (a number field
 * picked with a word), named by the filter it was picked for. Picks for filters the dashboard does not
 * have are ignored, as the operations drop them.
 */
export const findPickIssues = (
  filters: readonly TDashboardFilter[],
  picks: TDashboardFilterPicks
): TPickIssue[] => {
  if (exceedsPicksBudget(picks)) {
    return [
      {
        name: "picks",
        reason: `Picks may take at most ${MAX_DASHBOARD_FILTER_PICKS_CHARS} characters in all, each value counted percent-encoded (MAX_DASHBOARD_FILTER_PICKS_CHARS).`,
        code: "limit_exceeded",
      },
    ];
  }
  return filters.flatMap((filter) => {
    const values = pickValuesOf(filter, picks[filter.id]);
    if (!values) return [];
    const type = getDashboardFilterField(filter.field)?.type;
    const problem = values.map((value) => pickValueProblem(type, value)).find((reason) => reason !== null);
    return problem ? [{ name: `picks[${filter.id}]`, reason: problem }] : [];
  });
};

/**
 * AND `filters` onto a query's saved filters. Cube ANDs the entries of the top-level `filters` array, so
 * appending keeps every saved rule exactly as it was, at any depth — a saved top-level OR stays one entry —
 * and a rule on the same field is narrowed further, never replaced.
 */
export const narrowWithFilters = (query: TChartQuery, filters: readonly TCubeFilter[]): TChartQuery =>
  filters.length === 0 ? query : { ...query, filters: [...(query.filters ?? []), ...filters] };

/**
 * The values a pick applies: a list filter takes every chosen value ("is any of"), any other filter its one
 * typed value. Blank values are dropped; `null` when nothing is left, so the filter is not applied.
 */
export const pickValuesOf = (
  filter: Pick<TDashboardFilter, "field" | "operator">,
  values: readonly string[] | undefined
): string[] | null => {
  const kept = (values ?? []).filter((value) => value.trim() !== "");
  if (kept.length === 0) return null;
  return isListDashboardFilter(filter) ? kept : [kept[0]];
};

/** The filter rule one pick adds to a chart query. */
export const toPickRule = (filter: TDashboardFilter, values: string[]): TMemberFilter => ({
  member: filter.field,
  operator: filter.operator,
  values,
});

export type TResolvedPicks = {
  /** The rules to AND onto the chart's query, in the dashboard's filter order. */
  rules: TMemberFilter[];
  /** Picked filters whose field the chart's Feedback Dataset lacks: the chart shows no data. */
  unfilterable: TDashboardFilter[];
};

/**
 * Resolve picks against one chart's Feedback Dataset. Picks for filters the dashboard no longer has are
 * dropped; a picked filter whose field the dataset lacks makes the chart unfilterable rather than being
 * skipped, since skipping it would show the chart wider than the pick.
 */
export const resolvePicksForDataset = (
  filters: readonly TDashboardFilter[],
  picks: TDashboardFilterPicks,
  datasetHasField: (field: string) => boolean,
  { except }: { except?: string } = {}
): TResolvedPicks => {
  const rules: TMemberFilter[] = [];
  const unfilterable: TDashboardFilter[] = [];

  for (const filter of filters) {
    if (filter.id === except) continue;
    const values = pickValuesOf(filter, picks[filter.id]);
    if (!values) continue;
    if (datasetHasField(filter.field)) rules.push(toPickRule(filter, values));
    else unfilterable.push(filter);
  }

  return { rules, unfilterable };
};

const PICK_PARAM = /^picks\[([^\]]+)\]$/;

/**
 * Gather `picks[<filterId>]=value` parameters (repeated for several values) into one `picks` object and
 * `filter[<filterId>]=<operator>:<field>` parameters into one `rules` object, and leave every other
 * parameter as it was — the shape the routes' schemas validate.
 */
export const splitPickParams = (params: unknown): unknown => {
  if (typeof params !== "object" || params === null || Array.isArray(params)) return params;
  const rest: Record<string, unknown> = {};
  const picks: Record<string, string[]> = {};
  const rules: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(params)) {
    const match = PICK_PARAM.exec(name);
    const ruleId = filterRuleIdOf(name);
    if (match) picks[match[1]] = typeof value === "string" ? [value] : (value as string[]);
    else if (ruleId !== null) rules[ruleId] = value;
    else rest[name] = value;
  }
  return {
    ...rest,
    ...(Object.keys(picks).length > 0 ? { picks } : {}),
    ...(Object.keys(rules).length > 0 ? { rules } : {}),
  };
};

/**
 * Keep only picks for filters the dashboard still has, with at least one value. A remembered value that no
 * longer occurs in the data is kept: the person chose it, and the chart says it is empty.
 */
export const keepCurrentPicks = (
  filters: readonly Pick<TDashboardFilter, "id">[],
  picks: TDashboardFilterPicks
): TDashboardFilterPicks => {
  const current: TDashboardFilterPicks = {};
  for (const { id } of filters) {
    const values = picks[id]?.filter((value) => value !== "");
    if (values && values.length > 0) current[id] = values;
  }
  return current;
};

/**
 * The id a locked filter goes by within one read. A request's own ids match `FILTER_RULE_ID`, which allows
 * no `.`, so a request can never name a locked filter, and so never replace or drop its values.
 */
const lockedFilterId = (index: number): string => `locked.${index}`;

/**
 * A read's filters: the dashboard's locked ones (saved on it by an editor, with their values) first, then
 * the person's own from the request. Every one of them is ANDed onto each chart, so a person's filters can
 * only narrow what the locked ones already show. The request's picks are taken as they are; the locked
 * filters bring their own.
 */
export const withLockedFilters = (
  storedFilters: unknown,
  requestFilters: readonly TDashboardFilter[],
  requestPicks: TDashboardFilterPicks
): { filters: TDashboardFilter[]; picks: TDashboardFilterPicks } => {
  const locked = parseStoredDashboardFilters(storedFilters).map(({ values, ...filter }, index) => ({
    filter: { ...filter, id: lockedFilterId(index) },
    values,
  }));
  return {
    filters: [...locked.map(({ filter }) => filter), ...requestFilters],
    picks: {
      ...requestPicks,
      ...Object.fromEntries(locked.map(({ filter, values }) => [filter.id, values])),
    },
  };
};
