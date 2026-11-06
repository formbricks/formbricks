import { addDays } from "date-fns";
import type { TChartQuery, TCubeFilter, TMemberFilter } from "@formbricks/types/analysis";
import { getStartOfDayInTimeZone } from "@/lib/date-ranges";
import { parseLocalDay } from "@/lib/utils/datetime";
import { toEmbeddedNumberMember } from "@/modules/ee/analysis/lib/embedded-data-fields";
import { isRealIsoDate } from "./dashboard-date-filter";
import { filterRuleIdOf } from "./dashboard-filter-rules";
import {
  NO_VALUE_PICK,
  type TDashboardFilter,
  type TDashboardFilterOperator,
  type TDashboardFilterPicks,
  dashboardFilterTakesSeveralValues,
  dashboardFilterTakesValues,
  getDashboardFilterField,
  getMultiLabelValues,
  isEmbeddedComparisonFilter,
  isListDashboardFilter,
  isMultiLabelDashboardFilter,
  readStoredDashboardFilters,
} from "./dashboard-filters";
import { pickNeedsTextAnswer } from "./enrichment-filters";

/**
 * How a person's dashboard filter picks reach a chart query (ADR-0026). Pure functions over the Cube query
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

/**
 * A day, or a day with a time and an optional offset: only the shape. `Date.parse` then refuses what is
 * shaped right but no date at all.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-][\d:]+)?)?$/;

/**
 * Whether a value is a date: a real calendar day, alone or with a time. `Date.parse` rolls an impossible
 * day over ("2026-02-30" is March 2), so the day is checked apart.
 */
const isPickedDate = (value: string): boolean =>
  ISO_DATE.test(value) && isRealIsoDate(value.slice(0, 10)) && !Number.isNaN(Date.parse(value));

/** Why a picked value is no label of a multi-label field, or `null` when it is one. */
const labelProblem = (field: string, value: string): string | null => {
  const labels = getMultiLabelValues(field) ?? [];
  return labels.includes(value) ? null : `Must be one of: ${labels.join(", ")}.`;
};

/** Why a picked value cannot be compared with the field, or `null` when it can. */
const pickValueProblem = (
  filter: Pick<TDashboardFilter, "field" | "operator">,
  type: string | undefined,
  value: string
): string | null => {
  if (value === NO_VALUE_PICK) {
    return isListDashboardFilter(filter)
      ? null
      : "The no-value pick only goes with equals or notEquals on a field that has a value list.";
  }
  if (type === "number") {
    return value.trim() !== "" && Number.isFinite(Number(value)) ? null : "Must be a number.";
  }
  if (isMultiLabelDashboardFilter(filter)) return labelProblem(filter.field, value);
  if (type === "time") {
    return isPickedDate(value) ? null : "Must be a date (YYYY-MM-DD or an ISO 8601 timestamp).";
  }
  if (type === "boolean") return value === "true" || value === "false" ? null : "Must be true or false.";
  return null;
};

/**
 * What is wrong with a person's picks before any of them reaches a chart query: more characters
 * in all than `MAX_DASHBOARD_FILTER_PICKS_CHARS`, a value a filter's field cannot hold (a number field, or an
 * embedded-data key compared with a number,
 * picked with a word, a label a multi-label field does not have, the no-value pick on a filter without a
 * list), or values for a `set` / `notSet` filter, which takes none — each named by the filter it was
 * picked for. Picks for filters the dashboard does not have are ignored, as the operations drop them.
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
    const name = `picks[${filter.id}]`;
    if (!dashboardFilterTakesValues(filter.operator)) {
      return (picks[filter.id]?.length ?? 0) > 0
        ? [{ name, reason: "set and notSet compare against no value: send no picks for this filter." }]
        : [];
    }
    const values = pickValuesOf(filter, picks[filter.id]);
    if (!values) return [];
    // A number comparison on an embedded-data key compares it as a number (`isEmbeddedComparisonFilter`).
    const type = isEmbeddedComparisonFilter(filter) ? "number" : getDashboardFilterField(filter.field)?.type;
    const problem = values
      .map((value) => pickValueProblem(filter, type, value))
      .find((reason) => reason !== null);
    return problem ? [{ name, reason: problem }] : [];
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
 * The values a pick applies: a list filter takes every chosen value ("is any of"), a multi-label filter
 * every chosen label ("contains any of"), any other filter its one typed value, and `set` / `notSet` none —
 * they apply without a pick. Blank values are dropped; `null` when nothing is left, so the filter is not
 * applied.
 */
export const pickValuesOf = (
  filter: Pick<TDashboardFilter, "field" | "operator">,
  values: readonly string[] | undefined
): string[] | null => {
  if (!dashboardFilterTakesValues(filter.operator)) return [];
  const kept = (values ?? []).filter((value) => value.trim() !== "");
  if (kept.length === 0) return null;
  return dashboardFilterTakesSeveralValues(filter) ? kept : [kept[0]];
};

/** How a pick reads its values: calendar days are cut in this zone, the organization's reporting zone. */
export type TPickClock = { timeZone: string };

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The instant the day `offset` days after `day` begins in `timeZone`, as Cube is sent a timestamp. */
const dayStart = (day: string, offset: number, timeZone: string): string =>
  getStartOfDayInTimeZone(addDays(parseLocalDay(day), offset), timeZone).toISOString();

type TDayRule = (member: string, day: string, timeZone: string) => TCubeFilter;

/**
 * A comparison with a calendar day as whole days in the reporting zone, as the table toolbar's date filter
 * reads one (`resolveDateFilterBounds`): "after Oct 5" starts when Oct 6 does there, "before Oct 5" ends
 * when Oct 5 starts. Cube compares a time dimension with a bare day as midnight UTC, so the bounds are
 * sent as instants instead.
 */
const DAY_RULES: Partial<Record<TDashboardFilterOperator, TDayRule>> = {
  gt: (member, day, zone) => ({ member, operator: "gte", values: [dayStart(day, 1, zone)] }),
  gte: (member, day, zone) => ({ member, operator: "gte", values: [dayStart(day, 0, zone)] }),
  lt: (member, day, zone) => ({ member, operator: "lt", values: [dayStart(day, 0, zone)] }),
  lte: (member, day, zone) => ({ member, operator: "lt", values: [dayStart(day, 1, zone)] }),
  equals: (member, day, zone) => ({
    and: [
      { member, operator: "gte", values: [dayStart(day, 0, zone)] },
      { member, operator: "lt", values: [dayStart(day, 1, zone)] },
    ],
  }),
  // Records without a value pass, as they pass Cube's `notEquals`.
  notEquals: (member, day, zone) => ({
    or: [
      { member, operator: "lt", values: [dayStart(day, 0, zone)] },
      { member, operator: "gte", values: [dayStart(day, 1, zone)] },
      { member, operator: "notSet" },
    ],
  }),
};

/** The rule a pick of one calendar day on a time field makes, or `null` for any other pick. */
const toDayRule = (
  filter: TDashboardFilter,
  values: string[],
  { timeZone }: TPickClock
): TCubeFilter | null => {
  const [day] = values;
  if (values.length !== 1 || !CALENDAR_DAY.test(day)) return null;
  if (getDashboardFilterField(filter.field)?.type !== "time") return null;
  return DAY_RULES[filter.operator]?.(filter.field, day, timeZone) ?? null;
};

/**
 * The filter rule one pick adds to a chart query. `set` / `notSet` compare against nothing. `gt` / `gte` /
 * `lt` / `lte` on an embedded-data key go to Cube on its numeric twin (`FeedbackRecords.edn_*`), which
 * holds the key's value as a number and no value where it is not one. A calendar day
 * on a time field is whole days in `clock`'s zone (`DAY_RULES`). Several labels of a multi-label field go
 * to Cube as one `contains` (any of) or `notContains` (none of). The no-value pick (`NO_VALUE_PICK`) never
 * reaches Cube: "is" any of the values or no value is an OR with `notSet`, "is not" any of them with a
 * value an AND with `set` (Cube's `notEquals` lets records without a value through), and the no-value pick
 * alone is `notSet` or `set`.
 */
export const toPickRule = (filter: TDashboardFilter, values: string[], clock: TPickClock): TCubeFilter => {
  // An embedded-data key compared with a number is read as one, on its numeric twin.
  const member = isEmbeddedComparisonFilter(filter) ? toEmbeddedNumberMember(filter.field) : filter.field;
  if (!dashboardFilterTakesValues(filter.operator)) return { member, operator: filter.operator };
  const dayRule = toDayRule(filter, values, clock);
  if (dayRule) return dayRule;
  const real = values.filter((value) => value !== NO_VALUE_PICK);
  if (real.length === values.length) return { member, operator: filter.operator, values };

  const isNot = filter.operator === "notEquals";
  const presence: TMemberFilter = { member, operator: isNot ? "set" : "notSet" };
  if (real.length === 0) return presence;
  const rule: TMemberFilter = { member, operator: filter.operator, values: real };
  return isNot ? { and: [presence, rule] } : { or: [rule, presence] };
};

export type TResolvedPicks = {
  /** The rules to AND onto the chart's query, in the dashboard's filter order. */
  rules: TCubeFilter[];
  /**
   * Picked filters the chart cannot be narrowed by: its Feedback Dataset lacks their field, or the pick needs a
   * text answer the chart never reads (`pickNeedsTextAnswer`). The chart shows no data.
   */
  unfilterable: TDashboardFilter[];
};

/**
 * Resolve picks against one chart's Feedback Dataset. Picks for filters the dashboard no longer has are
 * dropped; a picked filter whose field the dataset lacks makes the chart unfilterable rather than being
 * skipped, since skipping it would show the chart wider than the pick. So does a pick on an enrichment field
 * (Sentiment, Sentiment Score, Emotions) that needs a value, on a chart whose saved query reads no text answer
 * (`excludesTextAnswers`, from `chartExcludesTextAnswers`): it could only ever show nothing. `timeZone` is
 * the organization's reporting zone, which a picked calendar day is cut in.
 */
export const resolvePicksForDataset = (
  filters: readonly TDashboardFilter[],
  picks: TDashboardFilterPicks,
  datasetHasField: (field: string) => boolean,
  {
    except,
    timeZone,
    excludesTextAnswers = false,
  }: { except?: string; timeZone: string; excludesTextAnswers?: boolean }
): TResolvedPicks => {
  const rules: TCubeFilter[] = [];
  const unfilterable: TDashboardFilter[] = [];

  for (const filter of filters) {
    if (filter.id === except) continue;
    const values = pickValuesOf(filter, picks[filter.id]);
    if (!values) continue;
    const narrowable =
      datasetHasField(filter.field) && !(excludesTextAnswers && pickNeedsTextAnswer(filter, values));
    if (narrowable) rules.push(toPickRule(filter, values, { timeZone }));
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
 * longer occurs in the data is kept: the person chose it, and the chart says it is empty. A `set` /
 * `notSet` filter has no pick to keep; it applies without one.
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
 * A dashboard's stored locked filters hold an entry that does not read as one. Reading its charts anyway
 * would leave that filter off and show readers more than it lets through, so the read is refused.
 */
export class UnreadableLockedFiltersError extends Error {
  constructor(readonly unreadable: number) {
    super(`${unreadable} of the dashboard's locked filters could not be read`);
    this.name = "UnreadableLockedFiltersError";
  }
}

/**
 * A read's filters: the dashboard's locked ones (saved on it by an editor, with their values) first, then
 * the person's own from the request. Every one of them is ANDed onto each chart, so a person's filters can
 * only narrow what the locked ones already show. The request's picks are taken as they are; the locked
 * filters bring their own. Fails closed: throws `UnreadableLockedFiltersError` when a stored locked filter
 * does not read, rather than reading without it.
 */
export const withLockedFilters = (
  storedFilters: unknown,
  requestFilters: readonly TDashboardFilter[],
  requestPicks: TDashboardFilterPicks
): { filters: TDashboardFilter[]; picks: TDashboardFilterPicks } => {
  const stored = readStoredDashboardFilters(storedFilters);
  if (stored.unreadable > 0) throw new UnreadableLockedFiltersError(stored.unreadable);
  const locked = stored.filters.map(({ values, ...filter }, index) => ({
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
