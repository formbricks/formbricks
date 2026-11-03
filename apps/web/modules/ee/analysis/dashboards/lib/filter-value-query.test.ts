import { describe, expect, test } from "vitest";
import type { TChartQuery, TCubeFilter } from "@formbricks/types/analysis";
import { type TMemoryRecord, recordMatches, runMemoryDimensionQuery } from "./cube-memory-test-utils";
import type { TDashboardDateFilter } from "./dashboard-date-filter";
import type { TDashboardFilter, TDashboardFilterPicks } from "./dashboard-filters";
import {
  FILTER_VALUE_LIST_LIMIT,
  type TFilterValueChart,
  buildFilterValueQueries,
  mergeFilterValues,
} from "./filter-value-query";

const CLOCK = { timeZone: "UTC", now: new Date("2026-11-03T12:00:00Z") };
const COLLECTED_AT = "FeedbackRecords.collectedAt";
const ACCOUNT = "FeedbackRecords.valueText";
const REGION = "FeedbackRecords.metadataCountry";
const PRODUCT = "FeedbackRecords.sourceName";
const CHANNEL = "FeedbackRecords.metadataSource";

const filter = (id: string, field: string, label = id): TDashboardFilter => ({
  id: `clfi${id.padStart(21, "0")}`,
  field,
  operator: "equals",
  label,
});

const ACCOUNT_FILTER = filter("1", ACCOUNT, "Account");
const REGION_FILTER = filter("2", REGION, "Region");
const PRODUCT_FILTER = filter("3", PRODUCT, "Product");
const CHANNEL_FILTER = filter("4", CHANNEL, "Channel");
const FILTERS = [ACCOUNT_FILTER, REGION_FILTER, PRODUCT_FILTER, CHANNEL_FILTER];

const everyField = () => true;

const chart = (
  datasetId: string,
  filters: TCubeFilter[] = [],
  dateRange?: [string, string]
): TFilterValueChart => ({
  datasetId,
  query: {
    measures: ["FeedbackRecords.count"],
    filters,
    ...(dateRange ? { timeDimensions: [{ dimension: COLLECTED_AT, granularity: "month", dateRange }] } : {}),
  },
});

const record = (
  fields: Partial<Record<string, string>>,
  datasetId = "ds_a"
): TMemoryRecord & { ds: string } => ({
  ds: datasetId,
  [COLLECTED_AT]: "2026-10-01",
  ...fields,
});

/** Run the built queries against in-memory records per dataset, as Cube would, and merge them. */
const runValues = (
  records: (TMemoryRecord & { ds: string })[],
  input: Parameters<typeof buildFilterValueQueries>[0]
) => {
  const queries = buildFilterValueQueries(input);
  const results = queries.map(({ datasetId, query }) =>
    runMemoryDimensionQuery(
      records.filter((r) => r.ds === datasetId),
      query
    )
  );
  return { queries, ...mergeFilterValues(input.filter.field, results) };
};

/**
 * The truth: the union over charts of the values each chart lets through on its own — its saved rules and
 * dates, the dashboard date, and the other picks — with a chart lacking a picked field letting nothing
 * through.
 */
const perChartUnion = (
  records: (TMemoryRecord & { ds: string })[],
  {
    target,
    charts,
    picks,
    dashboardRange,
    datasetHasField = () => true,
    search,
  }: {
    target: TDashboardFilter;
    charts: TFilterValueChart[];
    picks: TDashboardFilterPicks;
    dashboardRange?: [string, string];
    datasetHasField?: (datasetId: string, field: string) => boolean;
    search?: string;
  }
): string[] => {
  const values = new Set<string>();
  for (const { datasetId, query } of charts) {
    if (!datasetHasField(datasetId, target.field)) continue;
    const pickRules: TCubeFilter[] = [];
    let empty = false;
    for (const other of FILTERS) {
      if (other.id === target.id || !picks[other.id]?.length) continue;
      if (!datasetHasField(datasetId, other.field)) empty = true;
      pickRules.push({ member: other.field, operator: other.operator, values: picks[other.id] });
    }
    if (empty) continue;
    const narrowed: TChartQuery = {
      ...query,
      filters: [
        ...(query.filters ?? []),
        ...pickRules,
        ...(dashboardRange
          ? [{ member: COLLECTED_AT, operator: "inDateRange", values: dashboardRange }]
          : []),
      ],
    };
    for (const r of records) {
      const value = r[target.field];
      if (r.ds !== datasetId || !value || !recordMatches(r, narrowed)) continue;
      if (search && !value.toLowerCase().includes(search.toLowerCase())) continue;
      values.add(value);
    }
  }
  return [...values].sort((a, b) => a.localeCompare(b));
};

describe("buildFilterValueQueries", () => {
  test("never offers a value no chart lets through: per-field merging leaked this one (ENG-6895)", () => {
    // Chart 1 allows region North; chart 2 allows product Alpha. Account "leak" is South + Beta: neither
    // chart lets it through, though each of its fields passes one of the charts' rules.
    const records = [
      record({ [ACCOUNT]: "north-beta", [REGION]: "North", [PRODUCT]: "Beta" }),
      record({ [ACCOUNT]: "south-alpha", [REGION]: "South", [PRODUCT]: "Alpha" }),
      record({ [ACCOUNT]: "leak", [REGION]: "South", [PRODUCT]: "Beta" }),
    ];
    const charts = [
      chart("ds_a", [{ member: REGION, operator: "equals", values: ["North"] }]),
      chart("ds_a", [{ member: PRODUCT, operator: "equals", values: ["Alpha"] }]),
    ];

    const { values } = runValues(records, {
      filter: ACCOUNT_FILTER,
      filters: FILTERS,
      charts,
      picks: {},
      dateFilter: null,
      clock: CLOCK,
      datasetHasField: everyField,
    });

    expect(values.map((v) => v.value)).toEqual(["north-beta", "south-alpha"]);
  });

  test("keeps each chart's saved date range inside its own branch", () => {
    const records = [
      record({ [ACCOUNT]: "old-north", [REGION]: "North", [COLLECTED_AT]: "2025-01-15" }),
      record({ [ACCOUNT]: "new-north", [REGION]: "North", [COLLECTED_AT]: "2026-10-15" }),
      record({ [ACCOUNT]: "old-south", [REGION]: "South", [COLLECTED_AT]: "2025-01-15" }),
    ];
    const charts = [
      chart(
        "ds_a",
        [{ member: REGION, operator: "equals", values: ["North"] }],
        ["2026-01-01", "2026-12-31"]
      ),
      chart("ds_a", [{ member: REGION, operator: "equals", values: ["South"] }]),
    ];

    const { values } = runValues(records, {
      filter: ACCOUNT_FILTER,
      filters: FILTERS,
      charts,
      picks: {},
      dateFilter: null,
      clock: CLOCK,
      datasetHasField: everyField,
    });

    expect(values.map((v) => v.value)).toEqual(["new-north", "old-south"]);
  });

  test("is narrowed by the dashboard date and the other picks, never by its own pick", () => {
    const records = [
      record({ [ACCOUNT]: "a", [REGION]: "North", [COLLECTED_AT]: "2026-10-30" }),
      record({ [ACCOUNT]: "b", [REGION]: "South", [COLLECTED_AT]: "2026-10-30" }),
      record({ [ACCOUNT]: "c", [REGION]: "North", [COLLECTED_AT]: "2025-01-01" }),
    ];
    const dateFilter: TDashboardDateFilter = { type: "preset", value: "last 7 days" };

    const { values } = runValues(records, {
      filter: ACCOUNT_FILTER,
      filters: FILTERS,
      charts: [chart("ds_a")],
      picks: { [REGION_FILTER.id]: ["North"], [ACCOUNT_FILTER.id]: ["b"] },
      dateFilter,
      clock: CLOCK,
      datasetHasField: everyField,
    });

    expect(values.map((v) => v.value)).toEqual(["a"]);
  });

  test("merges charts with the same saved rules into one branch, and a chart with none into no OR at all", () => {
    const rules: TCubeFilter[] = [{ member: REGION, operator: "equals", values: ["North"] }];
    const twice = buildFilterValueQueries({
      filter: ACCOUNT_FILTER,
      filters: FILTERS,
      charts: [chart("ds_a", rules), chart("ds_a", rules)],
      picks: {},
      dateFilter: null,
      clock: CLOCK,
      datasetHasField: everyField,
    });
    expect(twice).toHaveLength(1);
    expect(twice[0].query.filters?.[0]).toEqual(rules[0]);

    const withUnfiltered = buildFilterValueQueries({
      filter: ACCOUNT_FILTER,
      filters: FILTERS,
      charts: [chart("ds_a", rules), chart("ds_a")],
      picks: {},
      dateFilter: null,
      clock: CLOCK,
      datasetHasField: everyField,
    });
    expect(withUnfiltered[0].query.filters).toEqual([{ member: ACCOUNT, operator: "set" }]);
  });

  test("asks one query per dataset that has the field, and none for a dataset missing another picked field", () => {
    const hasField = (datasetId: string, field: string) => !(datasetId === "ds_b" && field === CHANNEL);
    const charts = [chart("ds_a"), chart("ds_b"), chart("ds_c")];
    const noAccountInC = (datasetId: string, field: string) =>
      hasField(datasetId, field) && !(datasetId === "ds_c" && field === ACCOUNT);

    const base = { filter: ACCOUNT_FILTER, filters: FILTERS, charts, dateFilter: null, clock: CLOCK };
    expect(
      buildFilterValueQueries({ ...base, picks: {}, datasetHasField: noAccountInC }).map((q) => q.datasetId)
    ).toEqual(["ds_a", "ds_b"]);
    expect(
      buildFilterValueQueries({
        ...base,
        picks: { [CHANNEL_FILTER.id]: ["web"] },
        datasetHasField: noAccountInC,
      }).map((q) => q.datasetId)
    ).toEqual(["ds_a"]);
  });

  test("runs a chart whose rules refer to a measure on its own, outside the OR", () => {
    const queries = buildFilterValueQueries({
      filter: ACCOUNT_FILTER,
      filters: FILTERS,
      charts: [
        chart("ds_a", [{ member: REGION, operator: "equals", values: ["North"] }]),
        chart("ds_a", [{ member: PRODUCT, operator: "equals", values: ["Alpha"] }]),
        chart("ds_a", [{ member: "FeedbackRecords.npsScore", operator: "gt", values: ["50"] }]),
      ],
      picks: {},
      dateFilter: null,
      clock: CLOCK,
      datasetHasField: everyField,
    });

    expect(queries.map((q) => q.query.filters?.[0])).toEqual([
      {
        or: [
          { member: REGION, operator: "equals", values: ["North"] },
          { member: PRODUCT, operator: "equals", values: ["Alpha"] },
        ],
      },
      { member: "FeedbackRecords.npsScore", operator: "gt", values: ["50"] },
    ]);
  });

  test("answers no queries for a dashboard with no charts", () => {
    expect(
      buildFilterValueQueries({
        filter: ACCOUNT_FILTER,
        filters: FILTERS,
        charts: [],
        picks: {},
        dateFilter: null,
        clock: CLOCK,
        datasetHasField: everyField,
      })
    ).toEqual([]);
  });

  test("searches case-insensitively", () => {
    const records = ["Bianchi", "Rossi", "bianco"].map((name) => record({ [ACCOUNT]: name }));
    const { values } = runValues(records, {
      filter: ACCOUNT_FILTER,
      filters: FILTERS,
      charts: [chart("ds_a")],
      picks: {},
      dateFilter: null,
      clock: CLOCK,
      datasetHasField: everyField,
      search: "BIAN",
    });
    expect(values.map((v) => v.value)).toEqual(["Bianchi", "bianco"]);
  });

  test("equals the per-chart union on 20 charts over 2 datasets with nested saved rules and picks", () => {
    // Deterministic pseudo-random data and charts: the property holds for every combination generated.
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
    const regions = ["North", "South", "East", "West"];
    const products = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
    const channels = ["web", "email", "app"];
    const days = ["2025-06-01", "2026-02-10", "2026-08-20", "2026-10-30"];

    const records = Array.from({ length: 4000 }, (_, i) =>
      record(
        {
          [ACCOUNT]: `acct-${String(i % 900).padStart(4, "0")}`,
          [REGION]: pick(regions),
          [PRODUCT]: pick(products),
          [CHANNEL]: random() < 0.1 ? undefined : pick(channels),
          [COLLECTED_AT]: pick(days),
        },
        i % 3 === 0 ? "ds_b" : "ds_a"
      )
    );

    const randomRule = (depth: number): TCubeFilter => {
      if (depth < 2 && random() < 0.3) {
        const children = [randomRule(depth + 1), randomRule(depth + 1)];
        return random() < 0.5 ? { or: children } : { and: children };
      }
      const [member, vocabulary] = pick([
        [REGION, regions],
        [PRODUCT, products],
        [CHANNEL, channels],
      ] as const);
      return {
        member,
        operator: random() < 0.75 ? "equals" : "notEquals",
        values: vocabulary
          .filter(() => random() < 0.4)
          .slice(0, 3)
          .concat(pick(vocabulary)),
      };
    };

    const charts = Array.from({ length: 20 }, (_, i) =>
      chart(
        i % 2 === 0 ? "ds_a" : "ds_b",
        i === 7 ? [] : Array.from({ length: 1 + Math.floor(random() * 3) }, () => randomRule(0)),
        random() < 0.3 ? ["2026-01-01", "2026-12-31"] : undefined
      )
    );
    // ds_b has no channel field: a channel pick empties its charts.
    const datasetHasField = (datasetId: string, field: string) =>
      !(datasetId === "ds_b" && field === CHANNEL);

    const cases: {
      picks: TDashboardFilterPicks;
      dateFilter: TDashboardDateFilter | null;
      search?: string;
    }[] = [
      { picks: {}, dateFilter: null },
      { picks: { [REGION_FILTER.id]: ["North", "East"] }, dateFilter: null },
      {
        picks: { [PRODUCT_FILTER.id]: ["Beta"] },
        dateFilter: { type: "custom", range: ["2026-02-01", "2026-09-01"] },
      },
      { picks: { [CHANNEL_FILTER.id]: ["web"] }, dateFilter: null },
      {
        picks: { [REGION_FILTER.id]: ["West"], [ACCOUNT_FILTER.id]: ["acct-0001"] },
        dateFilter: null,
        search: "00",
      },
    ];

    for (const { picks, dateFilter, search } of cases) {
      const { values, hasMore } = runValues(records, {
        filter: ACCOUNT_FILTER,
        filters: FILTERS,
        charts,
        picks,
        dateFilter,
        clock: CLOCK,
        datasetHasField,
        search,
      });
      const union = perChartUnion(records, {
        target: ACCOUNT_FILTER,
        charts,
        picks,
        dashboardRange: dateFilter?.type === "custom" ? dateFilter.range : undefined,
        datasetHasField,
        search,
      });

      expect(values.map((v) => v.value)).toEqual(union.slice(0, FILTER_VALUE_LIST_LIMIT));
      expect(hasMore).toBe(union.length > FILTER_VALUE_LIST_LIMIT);
    }
  });
});

describe("mergeFilterValues", () => {
  const rowsOf = (values: string[]) => values.map((value) => ({ [ACCOUNT]: value }));

  test("answers nothing for no queries or no rows", () => {
    expect(mergeFilterValues(ACCOUNT, [])).toEqual({ values: [], hasMore: false });
    expect(mergeFilterValues(ACCOUNT, [[]])).toEqual({ values: [], hasMore: false });
  });

  test("shows exactly 100 values without hasMore, and says hasMore at the 101st", () => {
    const hundred = Array.from({ length: 100 }, (_, i) => `v${String(i).padStart(3, "0")}`);
    expect(mergeFilterValues(ACCOUNT, [rowsOf(hundred)])).toEqual({
      values: hundred.map((value) => ({ value })),
      hasMore: false,
    });
    const merged = mergeFilterValues(ACCOUNT, [rowsOf([...hundred, "v100"])]);
    expect(merged.values).toHaveLength(100);
    expect(merged.hasMore).toBe(true);
  });

  test("merges two datasets alphabetically, once each, and cuts at 100 with hasMore", () => {
    const a = Array.from({ length: 60 }, (_, i) => `a${String(i).padStart(2, "0")}`);
    const b = Array.from({ length: 60 }, (_, i) => `b${String(i).padStart(2, "0")}`);
    const merged = mergeFilterValues(ACCOUNT, [rowsOf([...a, "shared"]), rowsOf(["shared", ...b])]);
    expect(merged.values.slice(0, 2)).toEqual([{ value: "a00" }, { value: "a01" }]);
    expect(merged.values).toHaveLength(100);
    expect(merged.hasMore).toBe(true);
  });

  test("lists the first 100 of a field with 20,000 distinct values", () => {
    const records = Array.from({ length: 20_000 }, (_, i) =>
      record({ [ACCOUNT]: `account-${String(i).padStart(5, "0")}` })
    );
    const { values, hasMore } = runValues(records, {
      filter: ACCOUNT_FILTER,
      filters: FILTERS,
      charts: [chart("ds_a")],
      picks: {},
      dateFilter: null,
      clock: CLOCK,
      datasetHasField: everyField,
    });
    expect(values[0]).toEqual({ value: "account-00000" });
    expect(values).toHaveLength(100);
    expect(hasMore).toBe(true);
  });
});
