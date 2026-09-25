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

const { recordV3ResponsesRead, startV3ResponsesRead, tallyUnresolved, toFilterKeysAttribute, toStatusClass } =
  await import("./metrics");

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

    // The names are what dashboards and alerts key on, so they are pinned here.
    expect(mockCreateCounter.mock.calls.map(([name]) => name)).toEqual([
      "formbricks.api.v3.responses.reads",
      "formbricks.api.v3.responses.unresolved.entries",
      "formbricks.api.v3.responses.unresolved.responses",
    ]);
    expect(mockCreateHistogram.mock.calls.map(([name]) => name)).toEqual([
      "formbricks.api.v3.responses.read.duration",
      "formbricks.api.v3.responses.page.surveys",
    ]);
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

    expect(addsTo("formbricks.api.v3.responses.reads")).toEqual([
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
    expect(recordsTo("formbricks.api.v3.responses.read.duration")).toEqual([
      [42.5, { operation: "list", via: "mcp", status_class: "2xx" }],
    ]);
    expect(recordsTo("formbricks.api.v3.responses.page.surveys")).toEqual([[3, { via: "mcp" }]]);
    expect(addsTo("formbricks.api.v3.responses.unresolved.responses")).toEqual([[1, { operation: "list" }]]);
    expect(addsTo("formbricks.api.v3.responses.unresolved.entries")).toEqual([
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

    expect(addsTo("formbricks.api.v3.responses.reads")).toEqual([
      [1, { operation: "count", via: "api", status_class: "2xx", filters: "contactId", precision: "exact" }],
    ]);
    expect(recordsTo("formbricks.api.v3.responses.page.surveys")).toEqual([]);
    expect(addsTo("formbricks.api.v3.responses.unresolved.responses")).toEqual([]);
  });

  test("a rejected query still counts, under its status class and with no filter keys", () => {
    recordV3ResponsesRead({ operation: "list", via: "ui", status: 400, durationMs: 0.3 });

    expect(addsTo("formbricks.api.v3.responses.reads")).toEqual([
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

    expect(addsTo("formbricks.api.v3.responses.unresolved.responses")).toEqual([]);
    expect(addsTo("formbricks.api.v3.responses.unresolved.entries")).toEqual([]);
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
    expect(addsTo("formbricks.api.v3.responses.reads")).toEqual([
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
    const [[durationMs]] = recordsTo("formbricks.api.v3.responses.read.duration");
    expect(durationMs).toBeGreaterThanOrEqual(0);
  });

  test("the MCP route is reported as mcp whatever credential it carries", () => {
    const read = startV3ResponsesRead({
      operation: "get",
      authentication: { apiKeyId: "key_1" } as never,
      instance: "/api/mcp",
    });

    read.done(new Response(null, { status: 403 }));

    expect(addsTo("formbricks.api.v3.responses.reads")).toEqual([
      [1, { operation: "get", via: "mcp", status_class: "4xx", filters: "none" }],
    ]);
  });
});
