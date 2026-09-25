import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TV3ResponsesFilter } from "./parse-v3-responses-list-query";

const { mockAdd, mockRecord, mockCreateCounter, mockCreateHistogram } = vi.hoisted(() => {
  const mockAdd = vi.fn();
  const mockRecord = vi.fn();
  return {
    mockAdd,
    mockRecord,
    mockCreateCounter: vi.fn((name: string) => ({ name, add: mockAdd })),
    mockCreateHistogram: vi.fn((name: string) => ({ name, record: mockRecord })),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@opentelemetry/api", () => ({
  metrics: {
    getMeter: vi.fn(() => ({
      createCounter: mockCreateCounter,
      createHistogram: mockCreateHistogram,
    })),
  },
}));

const {
  V3_RESPONSES_PAGE_SURVEYS,
  V3_RESPONSES_READS_TOTAL,
  V3_RESPONSES_READ_DURATION_SECONDS,
  V3_RESPONSES_UNRESOLVED_ENTRIES_TOTAL,
  V3_RESPONSES_UNRESOLVED_RESPONSES_TOTAL,
  recordV3ResponsesRead,
  startV3ResponsesRead,
  tallyUnresolved,
  toFilterKeysAttribute,
  toStatusClass,
  withV3ResponsesReadMetrics,
} = await import("./metrics");

const WORKSPACE = "clrsworkspace0000000000000";

const filter = (overrides: Partial<TV3ResponsesFilter> = {}): TV3ResponsesFilter => ({
  workspaceId: WORKSPACE,
  ...overrides,
});

/** Which instrument a recorded call landed on, by the name it was created under. */
const instrumentName = (context: unknown): string | undefined => (context as { name?: string })?.name;
const addsTo = (name: string) =>
  mockAdd.mock.calls.filter((_call, index) => instrumentName(mockAdd.mock.contexts[index]) === name);
const recordsTo = (name: string) =>
  mockRecord.mock.calls.filter((_call, index) => instrumentName(mockRecord.mock.contexts[index]) === name);

describe("toFilterKeysAttribute", () => {
  test("is the sorted filter keys, without the always-present scope", () => {
    expect(
      toFilterKeysAttribute(
        filter({ surveyId: "svy_1", createdAtGte: new Date("2026-01-01T00:00:00Z"), finished: true })
      )
    ).toBe("createdAtGte,finished,surveyId");
  });

  test("an unfiltered scope and an unparsed query both read as none", () => {
    expect(toFilterKeysAttribute(filter())).toBe("none");
    expect(toFilterKeysAttribute(undefined)).toBe("none");
  });

  /** The values are what a caller filtered *on* — a contact id, a language — and never leave. */
  test("carries no filter values", () => {
    const attribute = toFilterKeysAttribute(
      filter({ contactId: "ctc_secret", languages: ["de-DE"], ids: ["clrsresponse000000000000"] })
    );

    expect(attribute).toBe("contactId,ids,languages");
    expect(attribute).not.toContain("ctc_secret");
    expect(attribute).not.toContain("de-DE");
  });
});

describe("toStatusClass", () => {
  test.each([
    [200, "2xx"],
    [400, "4xx"],
    [403, "4xx"],
    [502, "5xx"],
  ])("%s → %s", (status, expected) => {
    expect(toStatusClass(status)).toBe(expected);
  });
});

describe("tallyUnresolved", () => {
  test("counts responses with entries and entries by reason, ignoring clean responses", () => {
    expect(
      tallyUnresolved([
        { unresolved: [] },
        {
          unresolved: [
            { key: "q_gone", reason: "elementNotInSurvey", rawValue: "x" },
            { key: "q_gone_2", reason: "elementNotInSurvey", rawValue: "y" },
            { key: "v_gone", reason: "variableNotInSurvey", rawValue: 1 },
          ],
        },
        { unresolved: [{ key: "q_shape", reason: "valueShapeMismatch", rawValue: ["a"] }] },
      ])
    ).toEqual({
      responses: 2,
      entries: { elementNotInSurvey: 2, variableNotInSurvey: 1, valueShapeMismatch: 1 },
    });
  });

  test("a clean page is zero everywhere", () => {
    expect(tallyUnresolved([{ unresolved: [] }, { unresolved: [] }])).toEqual({ responses: 0, entries: {} });
  });
});

describe("recordV3ResponsesRead", () => {
  beforeEach(() => {
    mockAdd.mockClear();
    mockRecord.mockClear();
  });

  test("creates the five instruments under stable names, once", async () => {
    vi.resetModules();
    mockCreateCounter.mockClear();
    mockCreateHistogram.mockClear();
    const { recordV3ResponsesRead: record } = await import("./metrics");

    record({ operation: "get", via: "api", status: 200, durationMs: 1 });
    record({ operation: "get", via: "api", status: 200, durationMs: 1 });

    // The names are what dashboards and alerts key on, so they are pinned here — spelled the way the
    // Prometheus exporter emits them, so neither reader rewrites them.
    expect(mockCreateCounter.mock.calls.map(([name]) => name)).toEqual([
      "formbricks_api_v3_responses_reads_total",
      "formbricks_api_v3_responses_unresolved_entries_total",
      "formbricks_api_v3_responses_unresolved_responses_total",
    ]);
    expect(mockCreateHistogram.mock.calls.map(([name]) => name)).toEqual([
      "formbricks_api_v3_responses_read_duration_seconds",
      "formbricks_api_v3_responses_page_surveys",
    ]);
    expect(mockCreateHistogram).toHaveBeenCalledWith(
      "formbricks_api_v3_responses_read_duration_seconds",
      expect.objectContaining({ unit: "s" })
    );
  });

  test("a list page records its filter keys, paging flags, survey spread and unresolved tally", () => {
    recordV3ResponsesRead({
      operation: "list",
      via: "mcp",
      status: 200,
      durationMs: 42.5,
      filter: filter({ surveyId: "svy_1", finished: true }),
      cursorUsed: true,
      includeTotalCount: false,
      pageSurveyCount: 3,
      items: [
        { unresolved: [] },
        { unresolved: [{ key: "q_gone", reason: "elementNotInSurvey", rawValue: "x" }] },
      ],
    });

    expect(addsTo(V3_RESPONSES_READS_TOTAL)).toEqual([
      [
        1,
        {
          operation: "list",
          via: "mcp",
          status_class: "2xx",
          filters: "finished,surveyId",
          cursor: true,
          include_total_count: false,
        },
      ],
    ]);
    // Milliseconds in, seconds recorded: the histogram's buckets are second-scale.
    expect(recordsTo(V3_RESPONSES_READ_DURATION_SECONDS)).toEqual([
      [0.0425, { operation: "list", via: "mcp", status_class: "2xx" }],
    ]);
    expect(recordsTo(V3_RESPONSES_PAGE_SURVEYS)).toEqual([[3, { via: "mcp" }]]);
    expect(addsTo(V3_RESPONSES_UNRESOLVED_RESPONSES_TOTAL)).toEqual([[1, { operation: "list" }]]);
    expect(addsTo(V3_RESPONSES_UNRESOLVED_ENTRIES_TOTAL)).toEqual([
      [1, { operation: "list", reason: "elementNotInSurvey" }],
    ]);
  });

  test("a count records its precision and no paging or page attributes", () => {
    recordV3ResponsesRead({
      operation: "count",
      via: "api",
      status: 200,
      durationMs: 5,
      filter: filter({ contactId: "ctc_1" }),
      precision: "exact",
    });

    expect(addsTo(V3_RESPONSES_READS_TOTAL)).toEqual([
      [1, { operation: "count", via: "api", status_class: "2xx", filters: "contactId", precision: "exact" }],
    ]);
    expect(recordsTo(V3_RESPONSES_PAGE_SURVEYS)).toEqual([]);
    expect(addsTo(V3_RESPONSES_UNRESOLVED_RESPONSES_TOTAL)).toEqual([]);
  });

  test("a rejected query still counts, under its status class and with no filter keys", () => {
    recordV3ResponsesRead({ operation: "list", via: "ui", status: 400, durationMs: 0.3 });

    expect(addsTo(V3_RESPONSES_READS_TOTAL)).toEqual([
      [1, { operation: "list", via: "ui", status_class: "4xx", filters: "none" }],
    ]);
  });

  test("a clean page adds nothing to the unresolved counters", () => {
    recordV3ResponsesRead({
      operation: "get",
      via: "api",
      status: 200,
      durationMs: 2,
      items: [{ unresolved: [] }],
    });

    expect(addsTo(V3_RESPONSES_UNRESOLVED_RESPONSES_TOTAL)).toEqual([]);
    expect(addsTo(V3_RESPONSES_UNRESOLVED_ENTRIES_TOTAL)).toEqual([]);
  });

  test("an instrument failure never escapes into the read", () => {
    mockAdd.mockImplementationOnce(() => {
      throw new Error("exporter down");
    });

    expect(() =>
      recordV3ResponsesRead({ operation: "get", via: "api", status: 200, durationMs: 1 })
    ).not.toThrow();
  });
});

describe("startV3ResponsesRead", () => {
  beforeEach(() => {
    mockAdd.mockClear();
    mockRecord.mockClear();
  });

  test("hands the response back unchanged and records what the operation observed", () => {
    const read = startV3ResponsesRead({
      operation: "list",
      authentication: { apiKeyId: "key_1" } as never,
      instance: "/api/v3/responses",
    });
    read.observation.filter = filter({ surveyId: "svy_1" });
    read.observation.cursorUsed = false;
    read.observation.includeTotalCount = true;

    const response = new Response(null, { status: 200 });

    expect(read.done(response)).toBe(response);
    expect(addsTo(V3_RESPONSES_READS_TOTAL)).toEqual([
      [
        1,
        {
          operation: "list",
          via: "api",
          status_class: "2xx",
          filters: "surveyId",
          cursor: false,
          include_total_count: true,
        },
      ],
    ]);
    const [[durationMs]] = recordsTo(V3_RESPONSES_READ_DURATION_SECONDS);
    expect(durationMs).toBeGreaterThanOrEqual(0);
  });

  test("the MCP route is reported as mcp whatever credential it carries", () => {
    const read = startV3ResponsesRead({
      operation: "get",
      authentication: { apiKeyId: "key_1" } as never,
      instance: "/api/mcp",
    });

    read.done(new Response(null, { status: 403 }));

    expect(addsTo(V3_RESPONSES_READS_TOTAL)).toEqual([
      [1, { operation: "get", via: "mcp", status_class: "4xx", filters: "none" }],
    ]);
  });
});

describe("withV3ResponsesReadMetrics", () => {
  beforeEach(() => {
    mockAdd.mockClear();
    mockRecord.mockClear();
  });

  const request = (headers: Record<string, string> = {}) =>
    new NextRequest("http://localhost/api/v3/responses", { headers });

  /**
   * The wrapper answers 401, 429 and 400 before the operation runs, so without the boundary those
   * reads never reached the counter. Here the route never calls `startV3ResponsesRead` at all.
   */
  test("a read the wrapper refuses before the operation runs is still counted", async () => {
    const route = withV3ResponsesReadMetrics("list", async () => new Response(null, { status: 401 }));

    const response = await route(request({ authorization: "Bearer nope" }), undefined);

    expect(response.status).toBe(401);
    expect(addsTo(V3_RESPONSES_READS_TOTAL)).toEqual([
      [1, { operation: "list", via: "api", status_class: "4xx", filters: "none" }],
    ]);
    expect(recordsTo(V3_RESPONSES_READ_DURATION_SECONDS)).toHaveLength(1);
  });

  test("a read that reaches the operation is recorded once, with what the operation observed", async () => {
    const route = withV3ResponsesReadMetrics("list", async () => {
      const read = startV3ResponsesRead({
        operation: "list",
        authentication: { user: { id: "user_1" } } as never,
        instance: "/api/v3/responses",
      });
      read.observation.filter = filter({ surveyId: "svy_1" });
      read.observation.cursorUsed = false;
      read.observation.includeTotalCount = false;
      read.observation.pageSurveyCount = 1;
      return read.done(new Response(null, { status: 200 }));
    });

    await route(request({ "x-api-key": "fbk_looks_like_a_key" }), undefined);

    // Exactly one count, and the authenticated `via` (a session → ui) replaces the presented one
    // (the x-api-key header → api) once the operation has run.
    expect(addsTo(V3_RESPONSES_READS_TOTAL)).toEqual([
      [
        1,
        {
          operation: "list",
          via: "ui",
          status_class: "2xx",
          filters: "surveyId",
          cursor: false,
          include_total_count: false,
        },
      ],
    ]);
    expect(recordsTo(V3_RESPONSES_READ_DURATION_SECONDS)).toHaveLength(1);
    expect(recordsTo(V3_RESPONSES_PAGE_SURVEYS)).toEqual([[1, { via: "ui" }]]);
  });

  test("outside a boundary the operation records itself, so the MCP path is still covered", () => {
    const read = startV3ResponsesRead({
      operation: "get",
      authentication: { apiKeyId: "key_1" } as never,
      instance: "/api/mcp",
    });

    read.done(new Response(null, { status: 200 }));

    expect(addsTo(V3_RESPONSES_READS_TOTAL)).toEqual([
      [1, { operation: "get", via: "mcp", status_class: "2xx", filters: "none" }],
    ]);
  });
});
