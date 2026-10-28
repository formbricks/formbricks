import { describe, expect, test } from "vitest";
import {
  V3_FEEDBACK_QUERY_MAX_FILTER_DEPTH,
  V3_FEEDBACK_QUERY_MAX_FILTER_NODES,
  V3_FEEDBACK_QUERY_MAX_LIMIT,
  ZV3FeedbackQuery,
  ZV3FeedbackQueryBody,
} from "./schemas";

const NPS = "FeedbackRecords.npsScore";
const COUNT = "FeedbackRecords.count";
const SENTIMENT = "FeedbackRecords.sentiment";

const reasons = (input: unknown): string[] => {
  const result = ZV3FeedbackQuery.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
};

const nest = (depth: number): unknown => {
  let node: unknown = { member: SENTIMENT, operator: "equals", values: ["positive"] };
  for (let level = 0; level < depth; level += 1) node = { and: [node] };
  return node;
};

describe("ZV3FeedbackQuery accepts", () => {
  test("an aggregate with grouping, a time axis, filters and order", () => {
    const result = ZV3FeedbackQuery.safeParse({
      measures: [NPS, COUNT],
      dimensions: [SENTIMENT],
      timeDimensions: [
        { dimension: "FeedbackRecords.collectedAt", granularity: "week", dateRange: "last 30 days" },
      ],
      filters: [
        { member: "FeedbackRecords.fieldType", operator: "equals", values: ["nps"] },
        {
          or: [
            { member: "FeedbackRecords.language", operator: "equals", values: ["en"] },
            { member: "FeedbackRecords.valueNumber", operator: "gte", values: ["9"] },
          ],
        },
        { member: "FeedbackRecords.userId", operator: "set" },
      ],
      order: [[COUNT, "desc"]],
      limit: 50,
    });

    expect(result.success).toBe(true);
  });

  test("a dimension-only query and an explicit date pair", () => {
    expect(ZV3FeedbackQuery.safeParse({ dimensions: ["FeedbackRecords.fieldLabel"] }).success).toBe(true);
    expect(
      ZV3FeedbackQuery.safeParse({
        measures: [COUNT],
        timeDimensions: [
          { dimension: "FeedbackRecords.collectedAt", dateRange: ["2026-01-01", "2026-01-31T23:59:59Z"] },
        ],
      }).success
    ).toBe(true);
  });
});

describe("ZV3FeedbackQuery refuses fields outside the catalog", () => {
  test.each([
    ["an unknown measure", { measures: ["FeedbackRecords.revenue"] }, "measures.0"],
    ["a measure used as a dimension", { measures: [COUNT], dimensions: [NPS] }, "dimensions.0"],
    [
      "a non-time dimension on the time axis",
      { measures: [COUNT], timeDimensions: [{ dimension: SENTIMENT }] },
      "timeDimensions.0.dimension",
    ],
    ["another cube", { measures: ["Users.count"] }, "measures.0"],
  ])("%s", (_name, query, path) => {
    expect(reasons(query).some((reason) => reason.startsWith(path))).toBe(true);
  });

  test("the tenant member, as a dimension, a filter member or an order member", () => {
    const tenant = "FeedbackRecords.tenantId";
    expect(reasons({ measures: [COUNT], dimensions: [tenant] })).not.toHaveLength(0);
    expect(
      reasons({ measures: [COUNT], filters: [{ member: tenant, operator: "equals", values: ["x"] }] })
    ).not.toHaveLength(0);
    expect(reasons({ measures: [COUNT], order: [[tenant, "asc"]] })).not.toHaveLength(0);
  });

  test("a filter on a measure", () => {
    expect(
      reasons({ measures: [COUNT], filters: [{ member: NPS, operator: "gt", values: ["1"] }] })
    ).not.toHaveLength(0);
  });

  test("the error names the offending value and points at the catalog", () => {
    expect(reasons({ measures: ["FeedbackRecords.revenue"] })[0]).toContain("get_feedback_field_catalog");
    expect(reasons({ measures: ["FeedbackRecords.revenue"] })[0]).toContain("FeedbackRecords.revenue");
  });
});

describe("ZV3FeedbackQuery refuses Cube options the product never uses", () => {
  test.each([
    ["segments", { segments: ["FeedbackRecords.x"] }],
    ["offset", { offset: 10 }],
    ["total", { total: true }],
    ["ungrouped", { ungrouped: true }],
    ["renewQuery", { renewQuery: true }],
    ["joinHints", { joinHints: [["a", "b"]] }],
    ["timezone", { timezone: "Europe/Berlin" }],
    ["a tenant key", { tenantId: "x" }],
  ])("%s", (_name, extra) => {
    expect(ZV3FeedbackQuery.safeParse({ measures: [COUNT], ...extra }).success).toBe(false);
  });

  test("compareDateRange, and the legacy `dimension` alias for a filter member", () => {
    expect(
      ZV3FeedbackQuery.safeParse({
        measures: [COUNT],
        timeDimensions: [
          { dimension: "FeedbackRecords.collectedAt", compareDateRange: ["last 7 days", "last 30 days"] },
        ],
      }).success
    ).toBe(false);
    expect(
      ZV3FeedbackQuery.safeParse({
        measures: [COUNT],
        filters: [{ dimension: SENTIMENT, operator: "equals", values: ["x"] }],
      }).success
    ).toBe(false);
  });

  test("the request body cannot carry a tenant either", () => {
    const body = {
      workspaceId: "tz4a98xxat96iws9zmbrgj3a",
      query: { measures: [COUNT] },
    };
    expect(ZV3FeedbackQueryBody.safeParse(body).success).toBe(true);
    expect(ZV3FeedbackQueryBody.safeParse({ ...body, tenantId: "x" }).success).toBe(false);
    expect(ZV3FeedbackQueryBody.safeParse({ ...body, tenant_id: "x" }).success).toBe(false);
  });
});

describe("ZV3FeedbackQuery bounds", () => {
  test("limit stops at the maximum and must be positive", () => {
    expect(
      ZV3FeedbackQuery.safeParse({ measures: [COUNT], limit: V3_FEEDBACK_QUERY_MAX_LIMIT }).success
    ).toBe(true);
    expect(
      ZV3FeedbackQuery.safeParse({ measures: [COUNT], limit: V3_FEEDBACK_QUERY_MAX_LIMIT + 1 }).success
    ).toBe(false);
    expect(ZV3FeedbackQuery.safeParse({ measures: [COUNT], limit: 0 }).success).toBe(false);
    expect(ZV3FeedbackQuery.safeParse({ measures: [COUNT], limit: 1.5 }).success).toBe(false);
  });

  test("filter groups nest to the depth limit and no further", () => {
    expect(
      ZV3FeedbackQuery.safeParse({ measures: [COUNT], filters: [nest(V3_FEEDBACK_QUERY_MAX_FILTER_DEPTH)] })
        .success
    ).toBe(true);
    expect(
      reasons({ measures: [COUNT], filters: [nest(V3_FEEDBACK_QUERY_MAX_FILTER_DEPTH + 1)] }).join()
    ).toContain("nest at most");
  });

  test("a very deep tree is refused without recursing through all of it", () => {
    expect(ZV3FeedbackQuery.safeParse({ measures: [COUNT], filters: [nest(200)] }).success).toBe(false);
  });

  test("the whole tree is capped at the node budget", () => {
    const condition = { member: SENTIMENT, operator: "equals", values: ["positive"] };
    const groups = Array.from({ length: 3 }, () => ({
      or: Array.from({ length: V3_FEEDBACK_QUERY_MAX_FILTER_NODES - 1 }, () => condition),
    }));

    expect(reasons({ measures: [COUNT], filters: groups }).join()).toContain("at most");
  });

  test("an empty group, too many measures and a values list that is too long are refused", () => {
    expect(reasons({ measures: [COUNT], filters: [{ and: [] }] }).join()).toContain("empty");
    expect(ZV3FeedbackQuery.safeParse({ measures: Array.from({ length: 11 }, () => COUNT) }).success).toBe(
      false
    );
    expect(
      ZV3FeedbackQuery.safeParse({
        measures: [COUNT],
        filters: [{ member: SENTIMENT, operator: "equals", values: Array.from({ length: 51 }, () => "x") }],
      }).success
    ).toBe(false);
  });

  test("only one time axis", () => {
    const axis = { dimension: "FeedbackRecords.collectedAt" };
    expect(ZV3FeedbackQuery.safeParse({ measures: [COUNT], timeDimensions: [axis, axis] }).success).toBe(
      false
    );
  });
});

describe("ZV3FeedbackQuery semantic checks", () => {
  test("a query must select something", () => {
    expect(reasons({})[0]).toContain("at least one measure or dimension");
    expect(reasons({ filters: [{ member: SENTIMENT, operator: "set" }] })).not.toHaveLength(0);
  });

  test("order members must be selected", () => {
    expect(reasons({ measures: [COUNT], order: [[NPS, "asc"]] })[0]).toContain("Cannot order by");
    expect(ZV3FeedbackQuery.safeParse({ measures: [COUNT], order: [[COUNT, "asc"]] }).success).toBe(true);
  });

  test.each([
    [
      "an operator the field type does not take",
      { member: "FeedbackRecords.valueBoolean", operator: "gt", values: ["1"] },
    ],
    ["set with values", { member: SENTIMENT, operator: "set", values: ["x"] }],
    ["equals without values", { member: SENTIMENT, operator: "equals" }],
    [
      "a non-numeric value for a number field",
      { member: "FeedbackRecords.valueNumber", operator: "gt", values: ["lots"] },
    ],
    ["a non-boolean value", { member: "FeedbackRecords.valueBoolean", operator: "equals", values: ["yes"] }],
    ["an invalid date", { member: "FeedbackRecords.valueDate", operator: "gt", values: ["yesterday-ish"] }],
  ])("%s", (_name, filter) => {
    expect(ZV3FeedbackQuery.safeParse({ measures: [COUNT], filters: [filter] }).success).toBe(false);
  });

  test("a date range that ends before it starts, or is not a date", () => {
    const axis = (dateRange: unknown) => ({
      measures: [COUNT],
      timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", dateRange }],
    });
    expect(ZV3FeedbackQuery.safeParse(axis(["2026-02-01", "2026-01-01"])).success).toBe(false);
    expect(ZV3FeedbackQuery.safeParse(axis(["2026-13-45", "2026-14-01"])).success).toBe(false);
    expect(ZV3FeedbackQuery.safeParse(axis("sometime last week")).success).toBe(false);
  });
});
