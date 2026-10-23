import { describe, expect, test } from "vitest";
import {
  MAX_FIELDS,
  MAX_FILTER_CONDITIONS,
  MAX_FILTER_VALUES,
  MAX_FILTER_VALUE_LENGTH,
  MAX_LIMIT,
  MAX_MEASURES,
  MAX_OFFSET,
  MAX_ORDER_ENTRIES,
  parseQueryDateRange,
  parseRequestedDateRange,
  validateChartQuery,
} from "./chart-query-validator";

const COUNT = "FeedbackRecords.count";
const NPS = "FeedbackRecords.npsScore";
const SOURCE = "FeedbackRecords.sourceName";
const COLLECTED_AT = "FeedbackRecords.collectedAt";

const condition = (member = SOURCE, operator = "equals", values: string[] | undefined = ["web"]) => ({
  member,
  operator,
  ...(values ? { values } : {}),
});

const issuesOf = (input: unknown) => {
  const result = validateChartQuery(input);
  if (result.ok) throw new Error("expected the query to be refused");
  return result.issues;
};

const namesOf = (input: unknown) => issuesOf(input).map((issue) => issue.name);

describe("validateChartQuery", () => {
  test("accepts what the chart builder writes and returns it unchanged", () => {
    const query = {
      measures: [NPS, COUNT],
      dimensions: [SOURCE],
      timeDimensions: [{ dimension: COLLECTED_AT, granularity: "month", dateRange: "last 6 months" }],
      filters: [{ or: [{ and: [condition(), condition("FeedbackRecords.npsScore", "gte", ["9"])] }] }],
      order: [[NPS, "desc"]],
      limit: 100,
      offset: 0,
    };

    expect(validateChartQuery(query)).toEqual({ ok: true, query });
  });

  test("accepts an order object and a custom calendar-date range", () => {
    const query = {
      measures: [COUNT],
      timeDimensions: [{ dimension: COLLECTED_AT, dateRange: ["2026-01-01", "2026-01-31"] }],
      order: { [COUNT]: "asc" },
    };
    expect(validateChartQuery(query)).toEqual({ ok: true, query });
  });

  test("turns an all-time range into no range, which is what all time means to Cube", () => {
    expect(
      validateChartQuery({
        measures: [COUNT],
        timeDimensions: [{ dimension: COLLECTED_AT, dateRange: "all-time" }],
      })
    ).toEqual({ ok: true, query: { measures: [COUNT], timeDimensions: [{ dimension: COLLECTED_AT }] } });
  });

  describe("the field catalog", () => {
    test("refuses a field it does not list, hidden members included", () => {
      for (const member of [
        "FeedbackRecords.tenantId",
        "FeedbackRecords.id",
        "FeedbackRecords.sourceNameNormalized",
        "Other.count",
      ]) {
        expect(issuesOf({ measures: [COUNT], dimensions: [member] })).toEqual([
          expect.objectContaining({ name: "query.dimensions[0]", code: "invalid_reference" }),
        ]);
      }
    });

    test("refuses a field where its kind does not belong", () => {
      expect(namesOf({ measures: [SOURCE] })).toEqual(["query.measures[0]"]);
      expect(namesOf({ dimensions: [COUNT] })).toEqual(["query.dimensions[0]"]);
      expect(namesOf({ measures: [COUNT], timeDimensions: [{ dimension: SOURCE }] })).toEqual([
        "query.timeDimensions[0].dimension",
      ]);
    });

    test("checks filter and order members too, without echoing the value", () => {
      const issues = issuesOf({
        measures: [COUNT],
        filters: [condition("FeedbackRecords.secret")],
        order: [["FeedbackRecords.secret", "asc"]],
      });
      expect(issues.map((issue) => issue.name)).toEqual(["query.filters[0].member", "query.order[0]"]);
      expect(JSON.stringify(issues)).not.toContain("secret");
    });
  });

  describe("Cube options the app never uses", () => {
    test("an unknown key named like an Object.prototype member still gets a reason", () => {
      expect(issuesOf({ measures: [COUNT], constructor: 1, toString: 1 })).toEqual([
        { name: "query.constructor", reason: "Unsupported field 'constructor'.", code: "unsupported_field" },
        { name: "query.toString", reason: "Unsupported field 'toString'.", code: "unsupported_field" },
      ]);
    });

    test.each(["ungrouped", "segments", "renewQuery", "joinHints", "total", "timezone"])(
      "refuses %s",
      (option) => {
        expect(issuesOf({ measures: [COUNT], [option]: true })).toEqual([
          expect.objectContaining({ name: `query.${option}`, code: "unsupported_field" }),
        ]);
      }
    );

    test("names the organization's time zone when refusing a timezone", () => {
      expect(issuesOf({ measures: [COUNT], timezone: "Europe/Berlin" })[0].reason).toMatch(
        /organization's display time zone/
      );
    });

    test("refuses compareDateRange and any other unknown key, at the top level or on a time dimension", () => {
      expect(
        namesOf({
          measures: [COUNT],
          extra: 1,
          timeDimensions: [{ dimension: COLLECTED_AT, compareDateRange: ["today", "yesterday"] }],
        })
      ).toEqual(["query.extra", "query.timeDimensions[0].compareDateRange"]);
    });
  });

  describe("bounds", () => {
    const measures = (count: number) => Array.from({ length: count }, () => COUNT);

    test("caps measures and fields", () => {
      expect(validateChartQuery({ measures: measures(MAX_MEASURES) }).ok).toBe(true);
      expect(namesOf({ measures: measures(MAX_MEASURES + 1) })).toContain("query.measures");
      expect(
        namesOf({
          measures: measures(MAX_MEASURES),
          dimensions: Array.from({ length: 5 }, () => SOURCE),
          timeDimensions: [{ dimension: COLLECTED_AT }],
        })
      ).toEqual(["query"]);
      expect(MAX_MEASURES + 5 + 1).toBeGreaterThan(MAX_FIELDS);
    });

    test("needs at least one field", () => {
      expect(namesOf({})).toEqual(["query"]);
      expect(namesOf({ filters: [condition()] })).toEqual(["query"]);
    });

    test("caps the filter conditions across every group", () => {
      const conditions = (count: number) => Array.from({ length: count }, () => condition());

      expect(validateChartQuery({ measures: [COUNT], filters: conditions(MAX_FILTER_CONDITIONS) }).ok).toBe(
        true
      );
      expect(namesOf({ measures: [COUNT], filters: conditions(MAX_FILTER_CONDITIONS + 1) })).toEqual([
        "query.filters",
      ]);
      expect(
        namesOf({
          measures: [COUNT],
          filters: [{ and: conditions(MAX_FILTER_CONDITIONS) }, condition()],
        })
      ).toEqual(["query.filters"]);
    });

    test("allows a group inside a group, and no deeper", () => {
      const nested = { or: [{ and: [condition()] }] };
      expect(validateChartQuery({ measures: [COUNT], filters: [nested] }).ok).toBe(true);
      expect(namesOf({ measures: [COUNT], filters: [{ or: [{ and: [{ or: [condition()] }] }] }] })).toEqual([
        "query.filters[0].or[0].and[0]",
      ]);
    });

    test("refuses a malformed group", () => {
      expect(namesOf({ measures: [COUNT], filters: [{ and: [] }] })).toEqual(["query.filters[0].and"]);
      expect(namesOf({ measures: [COUNT], filters: [{ and: [condition()], or: [condition()] }] })).toEqual([
        "query.filters[0]",
      ]);
    });

    test("caps the values of a condition and their length", () => {
      expect(
        namesOf({
          measures: [COUNT],
          filters: [condition(SOURCE, "equals", Array(MAX_FILTER_VALUES + 1).fill("a"))],
        })
      ).toEqual(["query.filters[0].values"]);
      expect(
        namesOf({
          measures: [COUNT],
          filters: [condition(SOURCE, "equals", ["a".repeat(MAX_FILTER_VALUE_LENGTH + 1)])],
        })
      ).toEqual(["query.filters[0].values[0]"]);
    });

    test("checks the operator against the field's type and the values against the operator", () => {
      expect(namesOf({ measures: [COUNT], filters: [condition(NPS, "contains", ["1"])] })).toEqual([
        "query.filters[0].operator",
      ]);
      expect(namesOf({ measures: [COUNT], filters: [condition(SOURCE, "inDateRange", ["x"])] })).toEqual([
        "query.filters[0].operator",
      ]);
      expect(namesOf({ measures: [COUNT], filters: [condition(SOURCE, "equals", [])] })).toEqual([
        "query.filters[0].values",
      ]);
      expect(namesOf({ measures: [COUNT], filters: [condition(SOURCE, "set", ["x"])] })).toEqual([
        "query.filters[0].values",
      ]);
      expect(
        validateChartQuery({ measures: [COUNT], filters: [{ member: SOURCE, operator: "notSet" }] }).ok
      ).toBe(true);
    });

    test("caps order, limit and offset", () => {
      expect(
        namesOf({ measures: [COUNT], order: Array(MAX_ORDER_ENTRIES + 1).fill([COUNT, "asc"]) })
      ).toEqual(["query.order"]);
      expect(namesOf({ measures: [COUNT], order: [[COUNT, "sideways"]] })).toEqual(["query.order[0]"]);
      expect(namesOf({ measures: [COUNT], limit: MAX_LIMIT + 1 })).toEqual(["query.limit"]);
      expect(namesOf({ measures: [COUNT], limit: 0 })).toEqual(["query.limit"]);
      expect(namesOf({ measures: [COUNT], limit: 1.5 })).toEqual(["query.limit"]);
      expect(namesOf({ measures: [COUNT], offset: MAX_OFFSET + 1 })).toEqual(["query.offset"]);
      expect(validateChartQuery({ measures: [COUNT], limit: MAX_LIMIT, offset: MAX_OFFSET }).ok).toBe(true);
    });

    test("refuses an explicit range wider than the time-bucket limit, naming the fix (ENG-6603)", () => {
      const hourly = (dateRange: [string, string]) => ({
        measures: [COUNT],
        timeDimensions: [{ dimension: COLLECTED_AT, granularity: "hour", dateRange }],
      });

      // 1 Jan 2026 to 22 Feb 2027 is 418 days, 10,032 hours; one day less is 10,008. The limit is 10,000.
      expect(issuesOf(hourly(["2026-01-01", "2027-02-22"]))).toEqual([
        {
          name: "query.timeDimensions[0].dateRange",
          reason:
            "Spans 10032 hour buckets; at most 10000 are allowed. Use a coarser granularity or a shorter date range.",
          code: "limit_exceeded",
        },
      ]);
      expect(validateChartQuery(hourly(["2026-01-01", "2027-02-15"])).ok).toBe(true);
      expect(namesOf(hourly(["0100-01-01", "9999-12-31"]))).toEqual(["query.timeDimensions[0].dateRange"]);
    });

    test("limits only a chart grouped by time alone: any other grouping returns real rows only", () => {
      const wide = { dimension: COLLECTED_AT, granularity: "hour", dateRange: ["2020-01-01", "2026-12-31"] };

      expect(validateChartQuery({ measures: [COUNT], dimensions: [SOURCE], timeDimensions: [wide] }).ok).toBe(
        true
      );
      expect(
        validateChartQuery({
          measures: [COUNT],
          timeDimensions: [wide, { dimension: COLLECTED_AT, granularity: "day" }],
        }).ok
      ).toBe(true);
      expect(
        validateChartQuery({ measures: [COUNT], timeDimensions: [wide] }, { timeBuckets: false }).ok
      ).toBe(true);
    });

    test("leaves wide ranges alone where nothing fills buckets: a coarse granularity, none, or a preset", () => {
      const query = (timeDimension: Record<string, unknown>) => ({
        measures: [COUNT],
        timeDimensions: [{ dimension: COLLECTED_AT, ...timeDimension }],
      });

      expect(
        validateChartQuery(query({ granularity: "day", dateRange: ["2000-01-01", "2026-12-31"] })).ok
      ).toBe(true);
      expect(validateChartQuery(query({ dateRange: ["0100-01-01", "9999-12-31"] })).ok).toBe(true);
      expect(validateChartQuery(query({ granularity: "hour", dateRange: "last year" })).ok).toBe(true);
    });

    test("refuses a granularity the app does not offer", () => {
      expect(
        namesOf({ measures: [COUNT], timeDimensions: [{ dimension: COLLECTED_AT, granularity: "second" }] })
      ).toEqual(["query.timeDimensions[0].granularity"]);
    });
  });

  test("refuses anything that is not an object", () => {
    for (const input of [null, [], "measures", 3]) expect(namesOf(input)).toEqual(["query"]);
  });
});

describe("parseQueryDateRange", () => {
  test("takes the app's presets, all-time and real calendar-date pairs", () => {
    expect(parseQueryDateRange("last 7 days")).toEqual({ ok: true, dateRange: "last 7 days" });
    expect(parseQueryDateRange("all-time")).toEqual({ ok: true, dateRange: undefined });
    expect(parseQueryDateRange(["2026-02-01", "2026-02-28"])).toEqual({
      ok: true,
      dateRange: ["2026-02-01", "2026-02-28"],
    });
  });

  test.each([
    ["a Cube expression", "from 7 days ago to now"],
    ["a preset in other casing", "Last 7 Days"],
    ["an impossible date", ["2026-02-01", "2026-02-30"]],
    ["a reversed range", ["2026-03-01", "2026-02-01"]],
    ["timestamps", ["2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z"]],
    ["one date", ["2026-01-01"]],
    ["a number", 7],
  ])("refuses %s", (_label, value) => {
    expect(parseQueryDateRange(value)).toEqual({ ok: false });
  });
});

describe("parseRequestedDateRange", () => {
  test("reads a preset, all-time or a from/to pair as the dashboard date filter does", () => {
    expect(parseRequestedDateRange(undefined)).toEqual({ ok: true, filter: null });
    expect(parseRequestedDateRange("this month")).toEqual({
      ok: true,
      filter: { type: "preset", value: "this month" },
    });
    expect(parseRequestedDateRange("all-time")).toEqual({ ok: true, filter: { type: "all-time" } });
    expect(parseRequestedDateRange({ from: "2026-01-01", to: "2026-01-07" })).toEqual({
      ok: true,
      filter: { type: "custom", range: ["2026-01-01", "2026-01-07"] },
    });
  });

  test.each([
    ["an unknown preset", "last 8 days"],
    ["a reversed pair", { from: "2026-02-01", to: "2026-01-01" }],
    ["a pair with a time zone", { from: "2026-01-01", to: "2026-01-07", timezone: "UTC" }],
    ["a tuple", ["2026-01-01", "2026-01-07"]],
  ])("refuses %s", (_label, value) => {
    expect(parseRequestedDateRange(value)).toEqual({ ok: false });
  });
});
