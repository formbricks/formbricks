import type { TChartQuery, TCubeFilter } from "@formbricks/types/analysis";

/**
 * A tiny in-memory stand-in for Cube's filter semantics, for tests only: it answers a dimension query over
 * a list of records the way Cube's SQL would, so a test can compare what a built query lets through with
 * what each chart lets through, without a Cube. Covers the operators dashboards use: `equals` (any of),
 * `notEquals` (none of, NULL included, as Cube does), `contains`/`notContains` (case-insensitive), `set`,
 * `notSet`, the comparisons, and `inDateRange` on `yyyy-MM-dd` days; `and`/`or` groups at any depth, and
 * every time dimension's `dateRange` given as a pair of days.
 */

export type TMemoryRecord = Record<string, string | null>;

const day = (value: string): string => value.slice(0, 10);

const matchesRule = (record: TMemoryRecord, rule: TCubeFilter): boolean => {
  if ("and" in rule) return rule.and.every((child) => matchesRule(record, child));
  if ("or" in rule) return rule.or.some((child) => matchesRule(record, child));

  const actual = record[rule.member] ?? null;
  const values = rule.values ?? [];
  switch (rule.operator) {
    case "equals":
      return actual !== null && values.includes(actual);
    case "notEquals":
      return actual === null || !values.includes(actual);
    case "contains":
      return actual !== null && values.some((v) => actual.toLowerCase().includes(v.toLowerCase()));
    case "notContains":
      return actual === null || values.every((v) => !actual.toLowerCase().includes(v.toLowerCase()));
    case "set":
      return actual !== null;
    case "notSet":
      return actual === null;
    case "gt":
      return actual !== null && Number(actual) > Number(values[0]);
    case "gte":
      return actual !== null && Number(actual) >= Number(values[0]);
    case "lt":
      return actual !== null && Number(actual) < Number(values[0]);
    case "lte":
      return actual !== null && Number(actual) <= Number(values[0]);
    case "inDateRange":
      return actual !== null && day(actual) >= day(values[0]) && day(actual) <= day(values[1]);
    default:
      throw new Error(`cube-memory: unsupported operator ${rule.operator}`);
  }
};

/** Whether a record passes a query's filters and every time dimension's date range. */
export const recordMatches = (record: TMemoryRecord, query: TChartQuery): boolean =>
  (query.filters ?? []).every((rule) => matchesRule(record, rule)) &&
  (query.timeDimensions ?? []).every((timeDimension) => {
    const range = timeDimension.dateRange;
    if (range === undefined) return true;
    if (!Array.isArray(range)) throw new Error("cube-memory: only explicit date ranges are supported");
    return matchesRule(record, { member: timeDimension.dimension, operator: "inDateRange", values: range });
  });

/** A one-dimension query's rows: the distinct values of matching records, ordered and limited as asked. */
export const runMemoryDimensionQuery = (
  records: readonly TMemoryRecord[],
  query: TChartQuery
): Record<string, string>[] => {
  const [dimension] = query.dimensions ?? [];
  if (!dimension) throw new Error("cube-memory: a dimension query is needed");
  const values = new Set<string>();
  for (const record of records) {
    const value = record[dimension];
    if (value !== null && value !== undefined && recordMatches(record, query)) values.add(value);
  }
  const ordered = [...values].sort((a, b) => a.localeCompare(b));
  const limited = query.limit === undefined ? ordered : ordered.slice(0, query.limit);
  return limited.map((value) => ({ [dimension]: value }));
};
