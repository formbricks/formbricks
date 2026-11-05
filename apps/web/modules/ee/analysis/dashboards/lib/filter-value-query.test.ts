import { describe, expect, test } from "vitest";
import type { TChartQuery, TCubeFilter } from "@formbricks/types/analysis";
import {
  MAX_FILTER_CONDITIONS,
  countFilterConditions,
  validateChartQuery,
} from "@/modules/ee/analysis/lib/chart-query-validator";
import { type TMemoryRecord, recordMatches, runMemoryDimensionQuery } from "./cube-memory-test-utils";
import type { TDashboardDateFilter } from "./dashboard-date-filter";
import type { TDashboardFilter, TDashboardFilterPicks } from "./dashboard-filters";
import {
  FILTER_VALUE_GROUP_LIMIT,
  FILTER_VALUE_LIST_LIMIT,
  type TFilterValueChart,
  buildBoundedChartQueries,
  buildFilterValueQueries,
  isGroupBoundedChart,
  mergeFilterValues,
  resolveBoundedChartValues,
  valuesWhoseLabelMatches,
  withValueLabels,
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

  test("leaves a chart whose rules refer to a measure out of the merged queries: it is bounded by its groups (S6)", () => {
    const queries = buildFilterValueQueries({
      filter: ACCOUNT_FILTER,
      filters: FILTERS,
      charts: [
        chart("ds_a", [{ member: REGION, operator: "equals", values: ["North"] }]),
        chart("ds_a", [{ member: PRODUCT, operator: "equals", values: ["Alpha"] }]),
        chart("ds_a", [{ member: "FeedbackRecords.count", operator: "gt", values: ["50"] }]),
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

  test("lists a yes/no field's values as true / false, whether Cube returns booleans or text", () => {
    const field = "FeedbackRecords.valueBoolean";
    expect(mergeFilterValues(field, [[{ [field]: true }, { [field]: "false" }, { [field]: null }]])).toEqual({
      values: [{ value: "true" }, { value: "false" }],
      hasMore: false,
    });
  });

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

/**
 * A chart's own rows, the way Cube groups them: by its dimensions, counted, kept by its count rules
 * (HAVING), ordered by count descending and cut by limit and offset. Enough for the bounded-chart tests.
 */
const runGroupQuery = (records: TMemoryRecord[], query: TChartQuery): Record<string, string | number>[] => {
  const dimensions = query.dimensions ?? [];
  const recordRules = (query.filters ?? []).filter(
    (rule) => !("member" in rule && rule.member === "FeedbackRecords.count")
  );
  const countRules = (query.filters ?? []).flatMap((rule) =>
    "member" in rule && rule.member === "FeedbackRecords.count" ? [rule] : []
  );
  const groups = new Map<string, { row: Record<string, string>; count: number }>();
  for (const r of records) {
    if (!recordMatches(r, { ...query, filters: recordRules })) continue;
    const row = Object.fromEntries(dimensions.map((d) => [d, r[d] ?? ""]));
    const key = JSON.stringify(row);
    const group = groups.get(key) ?? { row, count: 0 };
    group.count += 1;
    groups.set(key, group);
  }
  const kept = [...groups.values()].filter(({ count }) =>
    countRules.every((rule) => count > Number(rule.values?.[0]))
  );
  kept.sort((a, b) => b.count - a.count || JSON.stringify(a.row).localeCompare(JSON.stringify(b.row)));
  const from = query.offset ?? 0;
  return kept
    .slice(from, query.limit === undefined ? undefined : from + query.limit)
    .map(({ row, count }) => ({ ...row, "FeedbackRecords.count": count }));
};

/** Both phases for the bounded charts, in memory: their own rows, then the values within their groups. */
const runBounded = (records: TMemoryRecord[], input: Parameters<typeof buildFilterValueQueries>[0]) =>
  buildBoundedChartQueries(input).flatMap((group) => {
    const resolved = resolveBoundedChartValues({
      filter: input.filter,
      group,
      rows: runGroupQuery(records, group.query),
      search: input.search,
    });
    if (resolved.type === "values") return resolved.values;
    if (resolved.type === "query") {
      return runMemoryDimensionQuery(records, resolved.query.query).map((row) => row[input.filter.field]);
    }
    return [];
  });

describe("charts bounded by their own groups: top-N and HAVING (S6)", () => {
  const COUNT = "FeedbackRecords.count";
  const PRODUCT_LIST = filter("3", PRODUCT, "Product");
  const records = [
    record({ [ACCOUNT]: "a1", [PRODUCT]: "Alpha", [REGION]: "North" }),
    record({ [ACCOUNT]: "a2", [PRODUCT]: "Alpha", [REGION]: "North" }),
    record({ [ACCOUNT]: "a3", [PRODUCT]: "Alpha", [REGION]: "South" }),
    record({ [ACCOUNT]: "b1", [PRODUCT]: "Beta", [REGION]: "South" }),
  ];
  const topProduct: TFilterValueChart = {
    datasetId: "ds_a",
    query: { measures: [COUNT], dimensions: [PRODUCT], order: [[COUNT, "desc"]], limit: 1 },
  };
  const base = {
    filters: FILTERS,
    picks: {},
    dateFilter: null,
    clock: CLOCK,
    datasetHasField: everyField,
  };

  test("a chart with a limit, an offset, or a rule on a measure is bounded; a plain one is not", () => {
    expect(isGroupBoundedChart(topProduct.query)).toBe(true);
    expect(isGroupBoundedChart({ measures: [COUNT], offset: 5 })).toBe(true);
    expect(
      isGroupBoundedChart({
        measures: [COUNT],
        filters: [{ or: [{ member: COUNT, operator: "gt", values: ["1"] }] }],
      })
    ).toBe(true);
    expect(isGroupBoundedChart({ measures: [COUNT], dimensions: [PRODUCT] })).toBe(false);
  });

  test("top-N: a filter on the grouped field lists only the groups the chart shows", () => {
    const merged = buildFilterValueQueries({ ...base, filter: PRODUCT_LIST, charts: [topProduct] });
    expect(merged).toEqual([]);
    expect(runBounded(records, { ...base, filter: PRODUCT_LIST, charts: [topProduct] })).toEqual(["Alpha"]);
  });

  test("top-N: a filter on another field lists only values within the shown groups", () => {
    expect(runBounded(records, { ...base, filter: ACCOUNT_FILTER, charts: [topProduct] }).sort()).toEqual([
      "a1",
      "a2",
      "a3",
    ]);
  });

  test("HAVING: only values within groups whose measure passes the rule", () => {
    const busyRegions: TFilterValueChart = {
      datasetId: "ds_a",
      query: {
        measures: [COUNT],
        dimensions: [REGION],
        filters: [{ member: COUNT, operator: "gt", values: ["1"] }],
      },
    };
    // North has 2 records, South 2: both pass "> 1". With "> 2" neither does, so nothing is listed.
    expect(runBounded(records, { ...base, filter: ACCOUNT_FILTER, charts: [busyRegions] }).sort()).toEqual([
      "a1",
      "a2",
      "a3",
      "b1",
    ]);
    const none = {
      ...busyRegions,
      query: { ...busyRegions.query, filters: [{ member: COUNT, operator: "gt", values: ["2"] }] },
    };
    expect(runBounded(records, { ...base, filter: ACCOUNT_FILTER, charts: [none] })).toEqual([]);
  });

  test("lists nothing from a bounded chart with no dimensions: its measure rule bounds no group", () => {
    // A big number of the count with a HAVING-style rule. Its one row passes "> 1", but that holds for the
    // aggregate only; a pick of any single account would leave one record, which the rule hides.
    const busyTotal: TFilterValueChart = {
      datasetId: "ds_a",
      query: { measures: [COUNT], filters: [{ member: COUNT, operator: "gt", values: ["1"] }] },
    };
    expect(isGroupBoundedChart(busyTotal.query)).toBe(true);
    expect(buildFilterValueQueries({ ...base, filter: ACCOUNT_FILTER, charts: [busyTotal] })).toEqual([]);
    expect(runBounded(records, { ...base, filter: ACCOUNT_FILTER, charts: [busyTotal] })).toEqual([]);
  });

  test("searches the rows of a grouped field case-insensitively", () => {
    const top2 = { ...topProduct, query: { ...topProduct.query, limit: 2 } };
    expect(runBounded(records, { ...base, filter: PRODUCT_LIST, charts: [top2], search: "BET" })).toEqual([
      "Beta",
    ]);
  });

  test("lists nothing from a chart it cannot bound: grouped by time, or more groups than the cap", () => {
    const byMonth: TFilterValueChart = {
      datasetId: "ds_a",
      query: {
        measures: [COUNT],
        timeDimensions: [{ dimension: COLLECTED_AT, granularity: "month" }],
        limit: 3,
      },
    };
    expect(runBounded(records, { ...base, filter: ACCOUNT_FILTER, charts: [byMonth] })).toEqual([]);

    const many = Array.from({ length: FILTER_VALUE_GROUP_LIMIT + 1 }, (_, i) =>
      record({ [ACCOUNT]: `x${i}`, [REGION]: `r${i}` })
    );
    const allRegions: TFilterValueChart = {
      datasetId: "ds_a",
      query: { measures: [COUNT], dimensions: [REGION], limit: FILTER_VALUE_GROUP_LIMIT + 1 },
    };
    expect(runBounded(many, { ...base, filter: ACCOUNT_FILTER, charts: [allRegions] })).toEqual([]);
    const atCap = { ...allRegions, query: { ...allRegions.query, limit: FILTER_VALUE_GROUP_LIMIT } };
    expect(runBounded(many, { ...base, filter: ACCOUNT_FILTER, charts: [atCap] })).toHaveLength(
      FILTER_VALUE_GROUP_LIMIT
    );
  });

  test("a bounded chart's own query carries the other picks and the dashboard date", () => {
    const [group] = buildBoundedChartQueries({
      ...base,
      filter: ACCOUNT_FILTER,
      charts: [topProduct],
      picks: { [REGION_FILTER.id]: ["North"] },
      dateFilter: { type: "custom", range: ["2026-10-01", "2026-10-31"] },
    });
    expect(group.query.limit).toBe(1);
    expect(group.query.filters).toEqual(
      expect.arrayContaining([{ member: REGION, operator: "equals", values: ["North"] }])
    );
    expect(JSON.stringify(group.query)).toContain("2026-10-01");
  });

  test("leaves out a dataset missing the field, and a chart missing another picked field", () => {
    expect(
      buildBoundedChartQueries({
        ...base,
        filter: ACCOUNT_FILTER,
        charts: [topProduct],
        datasetHasField: (_ds, field) => field !== ACCOUNT,
      })
    ).toEqual([]);
    expect(
      buildBoundedChartQueries({
        ...base,
        filter: ACCOUNT_FILTER,
        charts: [topProduct],
        picks: { [CHANNEL_FILTER.id]: ["web"] },
        datasetHasField: (_ds, field) => field !== CHANNEL,
      })
    ).toEqual([]);
  });
});

describe("answer rules in the merged value queries", () => {
  const ANSWER = "FeedbackRecords.answer";
  const answerRules = (question: string, count: number): TCubeFilter[] =>
    Array.from({ length: count }, (_, index) => ({
      member: ANSWER,
      operator: "equals",
      values: [`${question}:opt_${index}`],
    }));
  const countAnswers = (filters: unknown): number =>
    JSON.stringify(filters).split(`"member":"${ANSWER}"`).length - 1;
  const input = (charts: TFilterValueChart[]) => ({
    filter: ACCOUNT_FILTER,
    filters: FILTERS,
    charts,
    picks: {},
    dateFilter: null,
    clock: CLOCK,
    datasetHasField: everyField,
  });

  test("no query carries more than MAX_ANSWER_RULES: charts are split across queries instead", () => {
    const charts = [
      chart("ds_a", answerRules("q1", 2)),
      chart("ds_a", answerRules("q2", 2)),
      chart("ds_a", answerRules("q3", 2)),
    ];

    const queries = buildFilterValueQueries(input(charts));

    expect(queries).toHaveLength(2);
    for (const { query } of queries) expect(countAnswers(query.filters)).toBeLessThanOrEqual(5);
    expect(queries.reduce((sum, { query }) => sum + countAnswers(query.filters), 0)).toBe(6);
  });

  test("a chart over the cap on its own is left out: it cannot run, so it shows no value", () => {
    const queries = buildFilterValueQueries(
      input([chart("ds_a", answerRules("q1", 6)), chart("ds_a", [{ member: PRODUCT, operator: "set" }])])
    );

    expect(queries).toHaveLength(1);
    expect(countAnswers(queries[0].query.filters)).toBe(0);
  });

  test("charts within the cap together stay one query", () => {
    const queries = buildFilterValueQueries(
      input([chart("ds_a", answerRules("q1", 2)), chart("ds_a", answerRules("q2", 3))])
    );

    expect(queries).toHaveLength(1);
    expect(countAnswers(queries[0].query.filters)).toBe(5);
  });
});

describe("filter conditions in the value queries", () => {
  /** `count` conditions on the product field, distinct per `tag` so charts never share a branch. */
  const conditions = (tag: string, count: number): TCubeFilter[] =>
    Array.from({ length: count }, (_, index) => ({
      member: PRODUCT,
      operator: "notEquals",
      values: [`${tag}_${index}`],
    }));
  const input = (charts: TFilterValueChart[], picks: TDashboardFilterPicks = {}) => ({
    filter: ACCOUNT_FILTER,
    filters: FILTERS,
    charts,
    picks,
    dateFilter: null,
    clock: CLOCK,
    datasetHasField: everyField,
  });
  const branchesOf = (queries: ReturnType<typeof buildFilterValueQueries>): string[] =>
    queries.flatMap(({ query }) => JSON.stringify(query.filters).match(/chart\d+_0"/g) ?? []);

  test("no query holds more than MAX_FILTER_CONDITIONS: 250 charts of 10 conditions split across queries, none lost", () => {
    const charts = Array.from({ length: 250 }, (_, index) => chart("ds_a", conditions(`chart${index}`, 10)));

    const queries = buildFilterValueQueries(input(charts, { [REGION_FILTER.id]: ["North"] }));

    // 10 per chart, and 1 pick + 1 value rule per query: two charts per query.
    expect(queries).toHaveLength(125);
    for (const { query } of queries) {
      expect(countFilterConditions(query.filters)).toBeLessThanOrEqual(MAX_FILTER_CONDITIONS);
      expect(validateChartQuery(query).ok).toBe(true);
    }
    expect(new Set(branchesOf(queries)).size).toBe(250);
  });

  test("the picks and the search spend the budget before the charts do", () => {
    const charts = [chart("ds_a", conditions("chart1", 11)), chart("ds_a", conditions("chart2", 11))];

    // 22 + set = 23: one query.
    expect(buildFilterValueQueries(input(charts))).toHaveLength(1);
    // 22 + set + contains + one pick = 25: still one.
    expect(
      buildFilterValueQueries({ ...input(charts, { [REGION_FILTER.id]: ["North"] }), search: "acme" })
    ).toHaveLength(1);
    // A second pick makes 26: the charts split.
    expect(
      buildFilterValueQueries({
        ...input(charts, { [REGION_FILTER.id]: ["North"], [CHANNEL_FILTER.id]: ["web"] }),
        search: "acme",
      })
    ).toHaveLength(2);
  });

  test("a chart that cannot fit one query on its own is left out, the others still listed", () => {
    const queries = buildFilterValueQueries(
      input([
        chart("ds_a", conditions("chart1", MAX_FILTER_CONDITIONS)),
        chart("ds_a", conditions("chart2", 3)),
      ])
    );

    expect(queries).toHaveLength(1);
    expect(branchesOf(queries)).toEqual(['chart2_0"']);
  });

  test("a bounded chart whose saved filters and the picks pass MAX_FILTER_CONDITIONS together is left out", () => {
    const bounded = (count: number): TFilterValueChart => ({
      datasetId: "ds_a",
      query: {
        measures: ["FeedbackRecords.count"],
        dimensions: [PRODUCT],
        limit: 5,
        filters: conditions("c", count),
      },
    });
    const picks = { [REGION_FILTER.id]: ["North"] };

    expect(buildBoundedChartQueries(input([bounded(MAX_FILTER_CONDITIONS - 1)], picks))).toHaveLength(1);
    expect(buildBoundedChartQueries(input([bounded(MAX_FILTER_CONDITIONS)], picks))).toEqual([]);
  });
});

describe("values shown by a label (an answer's option)", () => {
  const OPTION = "FeedbackRecords.valueId";
  const OPTION_FILTER = filter("5", OPTION, "Value (Option)");
  const LABELS = { late: "Late", ontime: "On time", other: "Other" };
  const records = [
    record({ [OPTION]: "late" }),
    record({ [OPTION]: "ontime" }),
    record({ [OPTION]: "other" }),
  ];
  const base = {
    filter: OPTION_FILTER,
    filters: [OPTION_FILTER],
    charts: [chart("ds_a")],
    picks: {},
    dateFilter: null,
    clock: CLOCK,
    datasetHasField: everyField,
  };

  test("the values whose label holds a search, ignoring case and spaces around it", () => {
    expect(valuesWhoseLabelMatches(LABELS, " TIME ")).toEqual(["ontime"]);
    expect(valuesWhoseLabelMatches(LABELS, "")).toEqual([]);
    expect(valuesWhoseLabelMatches(LABELS, undefined)).toEqual([]);
  });

  test("at most MAX_FILTER_VALUES values, so they fit one condition", () => {
    const many = Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`id${i}`, `Option ${i}`]));
    expect(valuesWhoseLabelMatches(many, "option")).toHaveLength(100);
  });

  test("a search finds a value by its label as well as by its own text", () => {
    const search = "on t";
    const searchIds = valuesWhoseLabelMatches(LABELS, search);
    const { values } = runValues(records, { ...base, search, searchIds });
    expect(values.map((v) => v.value)).toEqual(["ontime"]);
    // Without the labels, "on t" names no stored value.
    expect(runValues(records, { ...base, search }).values).toEqual([]);
    // Its own text still finds it.
    expect(runValues(records, { ...base, search: "lat", searchIds: [] }).values).toEqual([{ value: "late" }]);
  });

  test("the label search costs one more condition, counted in the budget", () => {
    const [query] = buildFilterValueQueries({ ...base, search: "on t", searchIds: ["ontime"] });
    expect(countFilterConditions(query.query.filters)).toBe(3);
    expect(validateChartQuery(query.query).ok).toBe(true);
  });

  test("a chart bounded by its own groups finds a value by its label too", () => {
    const top: TFilterValueChart = {
      datasetId: "ds_a",
      query: { measures: ["FeedbackRecords.count"], dimensions: [OPTION], limit: 5 },
    };
    const [group] = buildBoundedChartQueries({ ...base, charts: [top] });
    const rows = [{ [OPTION]: "late" }, { [OPTION]: "ontime" }];
    expect(
      resolveBoundedChartValues({ filter: OPTION_FILTER, group, rows, search: "on t", searchIds: ["ontime"] })
    ).toEqual({ type: "values", values: ["ontime"] });
    expect(resolveBoundedChartValues({ filter: OPTION_FILTER, group, rows, search: "on t" })).toEqual({
      type: "values",
      values: [],
    });
  });

  test("each listed value carries its label, in label order; one without a label keeps its text", () => {
    const list = { values: [{ value: "late" }, { value: "ontime" }, { value: "b-unknown" }], hasMore: true };
    expect(withValueLabels(list, LABELS)).toEqual({
      values: [
        { value: "b-unknown" },
        { value: "late", label: "Late" },
        { value: "ontime", label: "On time" },
      ],
      hasMore: true,
    });
    expect(withValueLabels(list, {})).toBe(list);
  });

  test("a label is never taken from the object prototype", () => {
    const list = { values: [{ value: "constructor" }], hasMore: false };
    expect(withValueLabels(list, LABELS).values).toEqual([{ value: "constructor" }]);
  });
});
