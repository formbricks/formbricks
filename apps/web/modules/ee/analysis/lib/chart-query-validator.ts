import type { TChartQuery, TCubeFilter, TTimeDimension } from "@formbricks/types/analysis";
import { DATE_RANGE_PRESETS } from "@/lib/date-ranges";
import {
  type TDashboardDateFilter,
  isValidCalendarDateRange,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-date-filter";
import { ALL_TIME_DATE_RANGE, type TChartField, type TChartFieldKind, getChartField } from "./field-catalog";
import { TIME_GRANULARITIES } from "./schema-definition";
import { MAX_TIME_BUCKETS, countTimeBuckets } from "./time-buckets";

/**
 * The chart query validator (ADR 0001). The public chart query is the Cube query, so before one is
 * stored or run it is held to what the app itself produces:
 *
 * - every field is in the field catalog, in a position its kind allows — hidden members are refused
 *   simply because the catalog does not list them;
 * - Cube options the app never uses are refused rather than passed through (`ungrouped`, `segments`,
 *   `renewQuery`, `joinHints`, `total`, `compareDateRange`), and so is `timezone`: every date range is
 *   read in the organization's display time zone;
 * - field, filter and order counts, filter nesting, `limit`/`offset` and string lengths are bounded;
 * - a date range is a preset, `all-time`, or two ISO calendar dates, and with a granularity it spans at
 *   most `MAX_TIME_BUCKETS` buckets.
 *
 * Pure input → output, so it is unit-tested exhaustively and reused by every write and data read. It
 * returns the query in the shape the app runs and stores — `all-time` becomes "no date range" — or every
 * problem it found, each named by its path (`query.filters[0].member`), never echoing the offending value.
 */

/** Most measures a chart may compute; more is not a chart a person can read. */
export const MAX_MEASURES = 10;
/** Most grouping dimensions. */
export const MAX_DIMENSIONS = 5;
/** Most time dimensions; the app uses one, a filter-only one may sit beside it. */
export const MAX_TIME_DIMENSIONS = 2;
/** Most fields across measures, dimensions and time dimensions together. */
export const MAX_FIELDS = 15;
/** Most filter conditions in one query, counted through every group. */
export const MAX_FILTER_CONDITIONS = 25;
/** Deepest `and`/`or` group nesting; a top-level filter sits at depth 1. */
export const MAX_FILTER_DEPTH = 3;
/** Most values one filter condition may compare against — the size of a field-value lookup. */
export const MAX_FILTER_VALUES = 100;
/** Longest filter value. */
export const MAX_FILTER_VALUE_LENGTH = 1000;
/** Most order entries. */
export const MAX_ORDER_ENTRIES = 10;
/** Largest `limit`: enough rows for any chart, far below what makes Cube or a browser struggle. */
export const MAX_LIMIT = 5000;
/** Largest `offset`. */
export const MAX_OFFSET = 10_000;

/** Cube options the app never sends, each refused with the reason a caller needs to fix the query. */
const REFUSED_OPTIONS: Readonly<Record<string, string>> = {
  ungrouped: "Ungrouped queries are not supported; group by dimensions instead.",
  segments: "Segments are not supported; use filters instead.",
  renewQuery: "renewQuery is not supported; results are refreshed by the server.",
  joinHints: "joinHints are not supported.",
  total: "total is not supported.",
  timezone:
    "A time zone cannot be supplied: every date range is read in the organization's display time zone.",
};

const QUERY_KEYS = new Set([
  "measures",
  "dimensions",
  "timeDimensions",
  "filters",
  "order",
  "limit",
  "offset",
]);
const TIME_DIMENSION_KEYS = new Set(["dimension", "granularity", "dateRange"]);
const CONDITION_KEYS = new Set(["member", "operator", "values"]);
const VALUELESS_OPERATORS = new Set(["set", "notSet"]);
const DATE_PRESETS = new Set<string>(DATE_RANGE_PRESETS);

export type TChartQueryIssue = {
  name: string;
  reason: string;
  code?: "invalid_reference" | "limit_exceeded" | "unsupported_field";
};

export type TChartQueryValidation =
  | { ok: true; query: TChartQuery }
  | { ok: false; issues: TChartQueryIssue[] };

/** A date range as Cube takes it on a time dimension, `undefined` meaning "all time". */
export type TParsedDateRange = { ok: true; dateRange: string | [string, string] | undefined } | { ok: false };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A date range in the chart query's shape: a preset name, `all-time` (→ `undefined`), or a
 * `[from, to]` pair of ISO calendar dates with `from` not after `to`.
 */
export const parseQueryDateRange = (value: unknown): TParsedDateRange => {
  if (value === ALL_TIME_DATE_RANGE) return { ok: true, dateRange: undefined };
  if (typeof value === "string")
    return DATE_PRESETS.has(value) ? { ok: true, dateRange: value } : { ok: false };
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "string" &&
    typeof value[1] === "string" &&
    isValidCalendarDateRange(value[0], value[1])
  ) {
    return { ok: true, dateRange: [value[0], value[1]] };
  }
  return { ok: false };
};

/**
 * A date range a caller asks a chart's data for: a preset, `all-time`, or `{ from, to }` ISO calendar
 * dates. It replaces the range saved on the chart's `collectedAt` (`applyDashboardDateFilter`), exactly as
 * the dashboard date filter does, so an agent reading a chart for "last week" gets the numbers a person
 * sees on a dashboard filtered to last week. `null` when none was asked for.
 */
export const parseRequestedDateRange = (
  value: unknown
): { ok: true; filter: TDashboardDateFilter | null } | { ok: false } => {
  if (value === undefined) return { ok: true, filter: null };
  if (value === ALL_TIME_DATE_RANGE) return { ok: true, filter: { type: "all-time" } };
  if (typeof value === "string") {
    return DATE_PRESETS.has(value) ? { ok: true, filter: { type: "preset", value } } : { ok: false };
  }
  if (
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    typeof value.from === "string" &&
    typeof value.to === "string" &&
    isValidCalendarDateRange(value.from, value.to)
  ) {
    return { ok: true, filter: { type: "custom", range: [value.from, value.to] } };
  }
  return { ok: false };
};

/**
 * The time-bucket limit (ENG-6603). A chart grouped by time alone gets a row for every bucket in its
 * date range, empty or not — the Cube client fills them when the query's only grouping is one granular
 * time dimension, the first — so that range may span at most `MAX_TIME_BUCKETS` buckets. A chart with
 * any other grouping only ever returns its real rows and is not limited. Presets need no check: the
 * widest, a year, is 8,784 hours. `nameOf` names the problem for a time dimension's index; `null` when
 * the query is within the limit.
 */
export const checkTimeBucketLimit = (
  query: TChartQuery,
  nameOf: (index: number) => string
): TChartQueryIssue | null => {
  const timeDimensions = query.timeDimensions ?? [];
  const granular = timeDimensions.filter((timeDimension) => Boolean(timeDimension.granularity));
  if ((query.dimensions ?? []).length > 0 || granular.length !== 1 || granular[0] !== timeDimensions[0]) {
    return null;
  }

  const { granularity, dateRange } = timeDimensions[0];
  if (!granularity || !Array.isArray(dateRange)) return null;

  const buckets = countTimeBuckets(dateRange[0], dateRange[1], granularity);
  if (buckets <= MAX_TIME_BUCKETS) return null;
  return {
    name: nameOf(0),
    reason: `Spans ${buckets} ${granularity} buckets; at most ${MAX_TIME_BUCKETS} are allowed. Use a coarser granularity or a shorter date range.`,
    code: "limit_exceeded",
  };
};

export const DATE_RANGE_REASON =
  "Must be a date preset from the field catalog, 'all-time', or a [from, to] pair of ISO calendar dates (YYYY-MM-DD) with from not after to.";

class IssueCollector {
  readonly issues: TChartQueryIssue[] = [];

  add(name: string, reason: string, code?: TChartQueryIssue["code"]): void {
    this.issues.push({ name, reason, ...(code ? { code } : {}) });
  }
}

const KIND_LABELS: Record<TChartFieldKind, string> = {
  measure: "a measure",
  dimension: "a dimension",
  timeDimension: "a time dimension",
};

/** A catalog field at `path` whose kind is one of `kinds`, or `undefined` with the problem recorded. */
const checkField = (
  value: unknown,
  path: string,
  kinds: readonly TChartFieldKind[],
  issues: IssueCollector
): TChartField | undefined => {
  if (typeof value !== "string") {
    issues.add(path, "Must be a field name from the field catalog.");
    return undefined;
  }

  const field = getChartField(value);
  if (!field) {
    issues.add(path, "Not a field in the field catalog (GET /api/v3/charts/fields).", "invalid_reference");
    return undefined;
  }

  if (!kinds.includes(field.kind)) {
    issues.add(
      path,
      `Is ${KIND_LABELS[field.kind]}; only ${kinds.map((kind) => KIND_LABELS[kind]).join(" or ")} may be used here.`,
      "invalid_reference"
    );
    return undefined;
  }

  return field;
};

const checkFieldList = (
  value: unknown,
  path: string,
  kinds: readonly TChartFieldKind[],
  max: number,
  issues: IssueCollector
): string[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    issues.add(path, "Must be an array of field names.");
    return undefined;
  }
  if (value.length > max) {
    issues.add(path, `At most ${max} entries are allowed.`);
    return undefined;
  }

  const names: string[] = [];
  value.forEach((entry, index) => {
    if (checkField(entry, `${path}[${index}]`, kinds, issues)) names.push(entry as string);
  });
  return names;
};

const checkTimeDimensions = (
  value: unknown,
  path: string,
  issues: IssueCollector
): TTimeDimension[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    issues.add(path, "Must be an array of time dimensions.");
    return undefined;
  }
  if (value.length > MAX_TIME_DIMENSIONS) {
    issues.add(path, `At most ${MAX_TIME_DIMENSIONS} entries are allowed.`);
    return undefined;
  }

  const timeDimensions: TTimeDimension[] = [];
  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (!isRecord(entry)) {
      issues.add(entryPath, "Must be an object with a dimension.");
      return;
    }

    for (const key of Object.keys(entry)) {
      if (!TIME_DIMENSION_KEYS.has(key)) {
        issues.add(
          `${entryPath}.${key}`,
          key === "compareDateRange" ? "compareDateRange is not supported." : `Unsupported field '${key}'.`,
          "unsupported_field"
        );
      }
    }

    const field = checkField(entry.dimension, `${entryPath}.dimension`, ["timeDimension"], issues);
    const timeDimension: TTimeDimension = { dimension: entry.dimension as string };

    if (entry.granularity !== undefined) {
      if (
        typeof entry.granularity === "string" &&
        (TIME_GRANULARITIES as readonly string[]).includes(entry.granularity)
      ) {
        timeDimension.granularity = entry.granularity as TTimeDimension["granularity"];
      } else {
        issues.add(`${entryPath}.granularity`, `Must be one of: ${TIME_GRANULARITIES.join(", ")}.`);
      }
    }

    if (entry.dateRange !== undefined) {
      const parsed = parseQueryDateRange(entry.dateRange);
      if (!parsed.ok) issues.add(`${entryPath}.dateRange`, DATE_RANGE_REASON);
      else if (parsed.dateRange !== undefined) timeDimension.dateRange = parsed.dateRange;
    }

    if (field) timeDimensions.push(timeDimension);
  });
  return timeDimensions;
};

type TFilterBudget = { conditions: number };

const checkCondition = (
  entry: Record<string, unknown>,
  path: string,
  budget: TFilterBudget,
  issues: IssueCollector
): TCubeFilter | undefined => {
  budget.conditions += 1;

  for (const key of Object.keys(entry)) {
    if (!CONDITION_KEYS.has(key))
      issues.add(`${path}.${key}`, `Unsupported field '${key}'.`, "unsupported_field");
  }

  const field = checkField(entry.member, `${path}.member`, ["measure", "dimension", "timeDimension"], issues);
  const operator = entry.operator;
  if (typeof operator !== "string" || (field && !field.filterOperators.includes(operator as never))) {
    issues.add(
      `${path}.operator`,
      field
        ? `Must be one of this field's filter operators: ${field.filterOperators.join(", ")}.`
        : "Must be a filter operator listed for the field in the field catalog."
    );
    return undefined;
  }

  const values = entry.values;
  if (VALUELESS_OPERATORS.has(operator)) {
    if (values !== undefined && !(Array.isArray(values) && values.length === 0)) {
      issues.add(`${path}.values`, `The '${operator}' operator takes no values.`);
      return undefined;
    }
    return field ? { member: field.name, operator } : undefined;
  }

  if (!Array.isArray(values) || values.length === 0) {
    issues.add(`${path}.values`, `The '${operator}' operator needs at least one value.`);
    return undefined;
  }
  if (values.length > MAX_FILTER_VALUES) {
    issues.add(`${path}.values`, `At most ${MAX_FILTER_VALUES} values are allowed.`);
    return undefined;
  }
  const badValue = values.findIndex(
    (value) => typeof value !== "string" || value.length > MAX_FILTER_VALUE_LENGTH
  );
  if (badValue !== -1) {
    issues.add(
      `${path}.values[${badValue}]`,
      `Must be a string of at most ${MAX_FILTER_VALUE_LENGTH} characters.`
    );
    return undefined;
  }

  return field ? { member: field.name, operator, values: values as string[] } : undefined;
};

const checkFilter = (
  entry: unknown,
  path: string,
  depth: number,
  budget: TFilterBudget,
  issues: IssueCollector
): TCubeFilter | undefined => {
  // Past the condition budget the query is refused as a whole; walking on would only spend work on it.
  if (budget.conditions > MAX_FILTER_CONDITIONS) return undefined;
  if (!isRecord(entry)) {
    issues.add(path, "Must be a filter condition or an and/or group.");
    return undefined;
  }

  const groupKey = "and" in entry ? "and" : "or" in entry ? "or" : null;
  if (!groupKey) return checkCondition(entry, path, budget, issues);

  if (Object.keys(entry).length !== 1) {
    issues.add(path, "A group holds exactly one of 'and' or 'or', and nothing else.");
    return undefined;
  }
  if (depth >= MAX_FILTER_DEPTH) {
    issues.add(path, `Filter groups may nest at most ${MAX_FILTER_DEPTH} deep.`);
    return undefined;
  }

  const members = entry[groupKey];
  const groupPath = `${path}.${groupKey}`;
  if (!Array.isArray(members) || members.length === 0) {
    issues.add(groupPath, "Must be a non-empty array of filters.");
    return undefined;
  }

  const children = members.map((child, index) =>
    checkFilter(child, `${groupPath}[${index}]`, depth + 1, budget, issues)
  );
  if (children.some((child) => child === undefined)) return undefined;
  return groupKey === "and" ? { and: children as TCubeFilter[] } : { or: children as TCubeFilter[] };
};

const checkFilters = (value: unknown, path: string, issues: IssueCollector): TCubeFilter[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    issues.add(path, "Must be an array of filters.");
    return undefined;
  }
  if (value.length > MAX_FILTER_CONDITIONS) {
    issues.add(path, `At most ${MAX_FILTER_CONDITIONS} filter conditions are allowed in all.`);
    return undefined;
  }

  const budget: TFilterBudget = { conditions: 0 };
  const filters = value.map((entry, index) => checkFilter(entry, `${path}[${index}]`, 1, budget, issues));

  if (budget.conditions > MAX_FILTER_CONDITIONS) {
    issues.add(path, `At most ${MAX_FILTER_CONDITIONS} filter conditions are allowed in all.`);
  }
  return filters.filter((filter): filter is TCubeFilter => filter !== undefined);
};

const DIRECTIONS = new Set(["asc", "desc"]);

const checkOrder = (
  value: unknown,
  path: string,
  issues: IssueCollector
): TChartQuery["order"] | undefined => {
  if (value === undefined) return undefined;

  const entries: [unknown, unknown][] | null = Array.isArray(value)
    ? value.map((entry) =>
        Array.isArray(entry) && entry.length === 2 ? [entry[0], entry[1]] : [undefined, undefined]
      )
    : isRecord(value)
      ? Object.entries(value)
      : null;

  if (!entries) {
    issues.add(path, "Must be an array of [field, direction] pairs or an object of field: direction.");
    return undefined;
  }
  if (entries.length > MAX_ORDER_ENTRIES) {
    issues.add(path, `At most ${MAX_ORDER_ENTRIES} entries are allowed.`);
    return undefined;
  }

  const order: [string, "asc" | "desc"][] = [];
  entries.forEach(([member, direction], index) => {
    const entryPath = Array.isArray(value) ? `${path}[${index}]` : `${path}.${String(member)}`;
    const field = checkField(member, entryPath, ["measure", "dimension", "timeDimension"], issues);
    if (typeof direction !== "string" || !DIRECTIONS.has(direction)) {
      issues.add(entryPath, "The direction must be 'asc' or 'desc'.");
      return;
    }
    if (field) order.push([field.name, direction as "asc" | "desc"]);
  });

  return Array.isArray(value) ? order : Object.fromEntries(order);
};

const checkInteger = (
  value: unknown,
  path: string,
  min: number,
  max: number,
  issues: IssueCollector
): number | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    issues.add(path, `Must be an integer from ${min} to ${max}.`);
    return undefined;
  }
  return value;
};

/**
 * Validate a caller-supplied chart query against the field catalog and the bounds above. The
 * time-bucket limit is part of it unless `timeBuckets` is off — for a query whose date range is about
 * to be replaced, which is checked once the replacement is in (`runV3ChartQuery`).
 */
export const validateChartQuery = (
  input: unknown,
  { path = "query", timeBuckets = true }: { path?: string; timeBuckets?: boolean } = {}
): TChartQueryValidation => {
  const issues = new IssueCollector();

  if (!isRecord(input)) {
    issues.add(path, "Must be a chart query object.");
    return { ok: false, issues: issues.issues };
  }

  for (const key of Object.keys(input)) {
    if (QUERY_KEYS.has(key)) continue;
    issues.add(`${path}.${key}`, REFUSED_OPTIONS[key] ?? `Unsupported field '${key}'.`, "unsupported_field");
  }

  const measures = checkFieldList(input.measures, `${path}.measures`, ["measure"], MAX_MEASURES, issues);
  const dimensions = checkFieldList(
    input.dimensions,
    `${path}.dimensions`,
    ["dimension", "timeDimension"],
    MAX_DIMENSIONS,
    issues
  );
  const timeDimensions = checkTimeDimensions(input.timeDimensions, `${path}.timeDimensions`, issues);

  const fieldCount =
    (Array.isArray(input.measures) ? input.measures.length : 0) +
    (Array.isArray(input.dimensions) ? input.dimensions.length : 0) +
    (Array.isArray(input.timeDimensions) ? input.timeDimensions.length : 0);
  if (fieldCount > MAX_FIELDS) {
    issues.add(
      path,
      `At most ${MAX_FIELDS} fields are allowed across measures, dimensions and time dimensions.`
    );
  }
  if (fieldCount === 0) {
    issues.add(path, "A chart query needs at least one measure, dimension or time dimension.");
  }

  const filters = checkFilters(input.filters, `${path}.filters`, issues);
  const order = checkOrder(input.order, `${path}.order`, issues);
  const limit = checkInteger(input.limit, `${path}.limit`, 1, MAX_LIMIT, issues);
  const offset = checkInteger(input.offset, `${path}.offset`, 0, MAX_OFFSET, issues);

  if (issues.issues.length > 0) return { ok: false, issues: issues.issues };

  const query: TChartQuery = {
    ...(measures ? { measures } : {}),
    ...(dimensions ? { dimensions } : {}),
    ...(timeDimensions ? { timeDimensions } : {}),
    ...(filters ? { filters } : {}),
    ...(order ? { order } : {}),
    ...(limit === undefined ? {} : { limit }),
    ...(offset === undefined ? {} : { offset }),
  };
  const bucketIssue = timeBuckets
    ? checkTimeBucketLimit(query, (index) => `${path}.timeDimensions[${index}].dateRange`)
    : null;
  if (bucketIssue) return { ok: false, issues: [bucketIssue] };

  return { ok: true, query };
};
