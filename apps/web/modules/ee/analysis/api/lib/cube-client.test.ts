import { createCubeTransport } from "./__mocks__/cube-transport.mock";
import type * as CubeClient from "@cubejs-client/core";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getAuditRequestMetadata } from "@/modules/ee/audit-logs/lib/request-metadata";

vi.mock("server-only", () => ({}));
vi.mock("@/modules/ee/audit-logs/lib/request-metadata", () => ({
  UNKNOWN_AUDIT_REQUEST_METADATA: { ipAddress: "unknown", userAgent: "unknown" },
  getAuditRequestMetadata: vi
    .fn()
    .mockResolvedValue({ ipAddress: "203.0.113.7", userAgent: "cube-test-agent" }),
}));

const {
  auditFlags,
  mockGetOrganization,
  mockLoad,
  mockLoggerError,
  mockLoggerWarn,
  mockQueueAuditEventWithoutRequest,
  mockTablePivot,
} = vi.hoisted(() => ({
  auditFlags: { enabled: true },
  mockGetOrganization: vi.fn(),
  mockLoad: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockQueueAuditEventWithoutRequest: vi.fn(),
  mockTablePivot: vi.fn(),
}));

vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  get AUDIT_LOG_ENABLED() {
    return auditFlags.enabled;
  },
}));

vi.mock("@cubejs-client/core", () => ({
  default: vi.fn(() => ({
    load: mockLoad,
  })),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mockLoggerError,
    warn: mockLoggerWarn,
  },
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventWithoutRequest: mockQueueAuditEventWithoutRequest,
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganization: mockGetOrganization,
}));

const { mockGetEmbeddedChartFields } = vi.hoisted(() => ({ mockGetEmbeddedChartFields: vi.fn() }));
vi.mock("@/modules/ee/analysis/lib/embedded-data-fields.server", () => ({
  getEmbeddedChartFields: mockGetEmbeddedChartFields,
}));

const scopedInput = {
  query: { measures: ["FeedbackRecords.count"] },
  feedbackDirectoryId: "frd-1",
  workspaceId: "workspace-1",
  organizationId: "organization-1",
  actor: { type: "user" as const, id: "user-1" },
  source: "v3.charts.data" as const,
};

/** A stand-in Cube result: `tablePivot` is the mock, and it echoes a query with no time dimension. */
const stubResultSet = () => ({ tablePivot: mockTablePivot, query: () => ({}), rawData: () => [] });

type TCubeJsMock = {
  mock: { calls: [string, { apiUrl: string }][] };
  (...args: [string, { apiUrl: string }]): unknown;
};

const getCubeJsMock = async (): Promise<TCubeJsMock> => {
  const cubeModule = (await vi.importMock("@cubejs-client/core")) as { default: TCubeJsMock };
  return cubeModule.default;
};

describe("executeTenantScopedQuery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.resetModules();
    auditFlags.enabled = true;
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/formbricks?schema=public");
    vi.stubEnv("ENCRYPTION_KEY", "12345678901234567890123456789012");
    vi.stubEnv("HUB_API_URL", "https://hub.formbricks.local");
    vi.stubEnv("HUB_API_KEY", "test-hub-api-key");
    vi.stubEnv("CUBEJS_API_URL", "https://cube.example.com");
    vi.stubEnv("CUBEJS_API_SECRET", "cube-secret");
    vi.stubEnv("CUBEJS_JWT_AUDIENCE", "formbricks-cube-test");
    vi.stubEnv("CUBEJS_JWT_ISSUER", "formbricks-web-test");
    vi.mocked(getAuditRequestMetadata).mockResolvedValue({
      ipAddress: "203.0.113.7",
      userAgent: "cube-test-agent",
    });
    mockLoad.mockResolvedValue(stubResultSet());
    mockGetOrganization.mockResolvedValue({ displayTimeZone: null });
    mockQueueAuditEventWithoutRequest.mockResolvedValue(undefined);
    mockTablePivot.mockReturnValue([{ id: "1", count: 42 }]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("returns query results without reading request metadata when auditing is disabled", async () => {
    auditFlags.enabled = false;
    const { executeTenantScopedQuery } = await import("./cube-client");

    await expect(executeTenantScopedQuery(scopedInput)).resolves.toEqual([{ id: "1", count: 42 }]);
    expect(getAuditRequestMetadata).not.toHaveBeenCalled();
    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledWith(
      expect.objectContaining({ requestMetadata: { ipAddress: "unknown", userAgent: "unknown" } })
    );
  });

  test("loads query with a per-request tenant scoped token and returns tablePivot result", async () => {
    const { executeTenantScopedQuery } = await import("./cube-client");
    const result = await executeTenantScopedQuery(scopedInput);

    expect(mockLoad).toHaveBeenCalledWith({ ...scopedInput.query, timezone: "UTC" }, expect.anything());
    expect(mockTablePivot).toHaveBeenCalled();
    expect(result).toEqual([{ id: "1", count: 42 }]);

    const cubejs = await getCubeJsMock();
    const token = cubejs.mock.calls[0][0] as string;
    const payload = jwt.verify(token, "cube-secret", {
      audience: "formbricks-cube-test",
      issuer: "formbricks-web-test",
    }) as jwt.JwtPayload;

    expect(cubejs).toHaveBeenCalledWith(expect.any(String), {
      apiUrl: "https://cube.example.com/cubejs-api/v1",
      signal: expect.any(AbortSignal),
    });
    expect(payload).toMatchObject({
      tenantId: "frd-1",
      feedbackDirectoryId: "frd-1",
      workspaceId: "workspace-1",
      organizationId: "organization-1",
      userId: "user-1",
      scope: "xm:cube:query",
      source: "v3.charts.data",
    });
    expect(typeof payload.jti).toBe("string");
    // No Embedded Data in the query: no lookup, and the token compiles to the fixed schema.
    expect(payload.embeddedFields).toBeUndefined();
    expect(mockGetEmbeddedChartFields).not.toHaveBeenCalled();
  });

  describe("Embedded Data fields (ENG-2848)", () => {
    const brand = {
      id: "FeedbackRecords.ed_0123456789abcdef",
      name: "brand",
      type: "string" as const,
      surveyNames: ["Onboarding"],
    };
    const plan = {
      id: "FeedbackRecords.ed_fedcba9876543210",
      name: "plan",
      type: "number" as const,
      surveyNames: ["Onboarding"],
    };

    const decodeToken = async () => {
      const cubejs = await getCubeJsMock();
      return jwt.verify(cubejs.mock.calls[0][0], "cube-secret", {
        audience: "formbricks-cube-test",
        issuer: "formbricks-web-test",
      }) as jwt.JwtPayload;
    };

    test("signs every field of the dataset into the token when the query uses one", async () => {
      mockGetEmbeddedChartFields.mockResolvedValue([brand, plan]);
      const { executeTenantScopedQuery } = await import("./cube-client");

      await executeTenantScopedQuery({
        ...scopedInput,
        query: { measures: ["FeedbackRecords.count"], filters: [{ member: brand.id, operator: "set" }] },
      });

      expect(mockGetEmbeddedChartFields).toHaveBeenCalledWith("workspace-1", "frd-1");
      expect((await decodeToken()).embeddedFields).toEqual([
        { id: "ed_0123456789abcdef", hex: "6272616e64", type: "string" },
        { id: "ed_fedcba9876543210", hex: "706c616e", type: "number" },
      ]);
    });

    test("refuses a query naming a field the dataset no longer declares, before reaching Cube", async () => {
      mockGetEmbeddedChartFields.mockResolvedValue([plan]);
      const { executeTenantScopedQuery, UnknownEmbeddedFieldError } = await import("./cube-client");

      await expect(
        executeTenantScopedQuery({
          ...scopedInput,
          query: { measures: ["FeedbackRecords.count"], dimensions: [brand.id] },
        })
      ).rejects.toBeInstanceOf(UnknownEmbeddedFieldError);
      expect(mockLoad).not.toHaveBeenCalled();
      expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failure" })
      );
    });
  });

  test("drops the NULL value band from the query sent to Cube, not from the caller's query", async () => {
    const { executeTenantScopedQuery } = await import("./cube-client");
    const query = {
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.valueBand"],
      filters: [{ member: "FeedbackRecords.fieldType", operator: "equals", values: ["nps"] }],
    };
    await executeTenantScopedQuery({ ...scopedInput, query });

    expect(mockLoad).toHaveBeenCalledWith(
      {
        ...query,
        filters: [...query.filters, { member: "FeedbackRecords.valueBand", operator: "set" }],
        timezone: "UTC",
      },
      expect.anything()
    );
    expect(query.filters).toHaveLength(1);
  });

  test("queries Cube in the organization's display time zone and expands presets in it", async () => {
    // The client reads the clock while expanding the preset, so pin it: 22:30 UTC is still May 21 in UTC
    // but already May 22 in Berlin, which is exactly the rollover this test is about.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T22:30:00Z"));
    try {
      mockGetOrganization.mockResolvedValue({ displayTimeZone: "Europe/Berlin" });
      const { executeTenantScopedQuery } = await import("./cube-client");
      await executeTenantScopedQuery({
        ...scopedInput,
        query: {
          measures: ["FeedbackRecords.count"],
          timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", dateRange: "today" }],
        },
      });

      expect(mockGetOrganization).toHaveBeenCalledWith("organization-1");
      expect(mockLoad).toHaveBeenCalledWith(
        {
          measures: ["FeedbackRecords.count"],
          timezone: "Europe/Berlin",
          timeDimensions: [
            { dimension: "FeedbackRecords.collectedAt", dateRange: ["2026-05-22", "2026-05-22"] },
          ],
        },
        expect.anything()
      );
    } finally {
      vi.useRealTimers();
    }
  });

  test("reports a failed time zone lookup as a failed query instead of querying in the wrong zone", async () => {
    mockGetOrganization.mockRejectedValue(new Error("db down"));
    const { executeTenantScopedQuery } = await import("./cube-client");

    await expect(executeTenantScopedQuery(scopedInput)).rejects.toThrow("db down");
    expect(mockLoad).not.toHaveBeenCalled();
    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failure", targetType: "cubeQuery" })
    );
  });

  test("pivots with a sentinel fill value, because a null fill would still resolve to 0", async () => {
    const { executeTenantScopedQuery } = await import("./cube-client");
    await executeTenantScopedQuery(scopedInput);

    // The client resolves a cell as `row[measure] ?? fillWithValue ?? 0`, so passing null falls
    // through to 0. Only a non-nullish sentinel survives to be mapped back to null.
    expect(mockTablePivot).toHaveBeenCalledWith({ fillWithValue: "__formbricks_null__" });
  });

  test("maps the sentinel back to null so an unasked measure is not reported as zero", async () => {
    const npsQuery = {
      measures: ["FeedbackRecords.npsScore"],
      dimensions: ["FeedbackRecords.sourceName"],
    };
    mockTablePivot.mockReturnValue([
      { "FeedbackRecords.sourceName": "Pre-match", "FeedbackRecords.npsScore": "__formbricks_null__" },
      { "FeedbackRecords.sourceName": "After-match", "FeedbackRecords.npsScore": "72.92" },
      { "FeedbackRecords.sourceName": "Accessibility", "FeedbackRecords.npsScore": "0.00" },
    ]);
    const { executeTenantScopedQuery } = await import("./cube-client");
    const result = await executeTenantScopedQuery({ ...scopedInput, query: npsQuery });

    expect(result).toEqual([
      { "FeedbackRecords.sourceName": "Pre-match", "FeedbackRecords.npsScore": null },
      { "FeedbackRecords.sourceName": "After-match", "FeedbackRecords.npsScore": "72.92" },
      // A genuine zero must survive as a zero, not be swept up with the nulls.
      { "FeedbackRecords.sourceName": "Accessibility", "FeedbackRecords.npsScore": "0.00" },
    ]);
  });

  test("leaves a dimension that genuinely holds the sentinel string alone", async () => {
    mockTablePivot.mockReturnValue([
      {
        "FeedbackRecords.valueText": "__formbricks_null__",
        "FeedbackRecords.count": "__formbricks_null__",
      },
    ]);
    const { executeTenantScopedQuery } = await import("./cube-client");
    const result = await executeTenantScopedQuery({
      ...scopedInput,
      query: {
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.valueText"],
      },
    });

    // A respondent can type anything into an open text answer, including this sentinel. Only the
    // measure cell was filled by the pivot, so only that one may become null.
    expect(result).toEqual([
      { "FeedbackRecords.valueText": "__formbricks_null__", "FeedbackRecords.count": null },
    ]);
  });

  test("returns Cube 1.7's numeric strings as numbers for number members only", async () => {
    // A /load response from the bundled Cube 1.7.47 image, which serializes every number member as a
    // string, dimensions included. The real client parses it, so its annotation-driven cast is what is
    // under test rather than the options it was called with.
    const loadResponse = {
      queryType: "regularQuery",
      pivotQuery: {
        measures: ["FeedbackRecords.count", "FeedbackRecords.npsAverage"],
        dimensions: ["FeedbackRecords.valueText", "FeedbackRecords.valueNumber"],
        timeDimensions: [],
        queryType: "regularQuery",
      },
      results: [
        {
          query: {
            measures: ["FeedbackRecords.count", "FeedbackRecords.npsAverage"],
            dimensions: ["FeedbackRecords.valueText", "FeedbackRecords.valueNumber"],
            timeDimensions: [],
          },
          annotation: {
            measures: {
              "FeedbackRecords.count": { type: "number" },
              "FeedbackRecords.npsAverage": { type: "number" },
            },
            dimensions: {
              "FeedbackRecords.valueText": { type: "string" },
              "FeedbackRecords.valueNumber": { type: "number" },
            },
            segments: {},
            timeDimensions: {},
          },
          data: [
            {
              "FeedbackRecords.valueText": "123",
              "FeedbackRecords.valueNumber": "3",
              "FeedbackRecords.count": "2",
              "FeedbackRecords.npsAverage": null,
            },
            {
              "FeedbackRecords.valueText": null,
              "FeedbackRecords.valueNumber": "9",
              "FeedbackRecords.count": "1",
              "FeedbackRecords.npsAverage": "7.333333333333333",
            },
          ],
        },
      ],
    };
    const transport = createCubeTransport(loadResponse);
    const { CubeApi } = await vi.importActual<typeof CubeClient>("@cubejs-client/core");
    mockLoad.mockImplementationOnce((query: CubeClient.Query, options?: CubeClient.LoadMethodOptions) =>
      new CubeApi("token", { apiUrl: "https://cube.example.com/cubejs-api/v1", transport }).load(
        query,
        options
      )
    );
    const { executeTenantScopedQuery } = await import("./cube-client");

    const result = await executeTenantScopedQuery({
      ...scopedInput,
      query: {
        measures: ["FeedbackRecords.count", "FeedbackRecords.npsAverage"],
        dimensions: ["FeedbackRecords.valueText", "FeedbackRecords.valueNumber"],
      },
    });

    // "123" is what a respondent typed, not a number Cube computed, so it keeps its type; the NULL
    // average still comes back as null rather than 0.
    expect(result).toEqual([
      {
        "FeedbackRecords.valueText": "123",
        "FeedbackRecords.valueNumber": 3,
        "FeedbackRecords.count": 2,
        "FeedbackRecords.npsAverage": null,
      },
      {
        "FeedbackRecords.valueText": null,
        "FeedbackRecords.valueNumber": 9,
        "FeedbackRecords.count": 1,
        "FeedbackRecords.npsAverage": 7.333333333333333,
      },
    ]);
  });

  test("leaves every column alone when the query selects no measures", async () => {
    const rows = [{ "FeedbackRecords.valueText": "__formbricks_null__" }];
    mockTablePivot.mockReturnValue(rows);
    const { executeTenantScopedQuery } = await import("./cube-client");
    const result = await executeTenantScopedQuery({
      ...scopedInput,
      query: { dimensions: ["FeedbackRecords.valueText"] },
    });

    expect(result).toEqual(rows);
  });

  test("leaves a ratio measure null in a synthesized empty date bucket, alongside a real null", async () => {
    const DAY = "FeedbackRecords.collectedAt.day";
    // The pivot invents 2026-01-03 to fill the gap; 2026-01-02 is a day Cube returned, where the
    // measure is genuinely NULL (responses that day, none of them answering this question).
    mockTablePivot.mockImplementation((pivotConfig?: { fillMissingDates?: boolean }) => {
      const real = [
        { [DAY]: "2026-01-01", "FeedbackRecords.npsScore": "72.92" },
        { [DAY]: "2026-01-02", "FeedbackRecords.npsScore": "__formbricks_null__" },
      ];
      if (pivotConfig?.fillMissingDates === false) return real;
      return [...real, { [DAY]: "2026-01-03", "FeedbackRecords.npsScore": "__formbricks_null__" }];
    });

    const { executeTenantScopedQuery } = await import("./cube-client");
    const result = await executeTenantScopedQuery({
      ...scopedInput,
      query: {
        measures: ["FeedbackRecords.npsScore"],
        timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", granularity: "day" }],
      },
    });

    expect(result).toEqual([
      { [DAY]: "2026-01-01", "FeedbackRecords.npsScore": "72.92" },
      // real bucket, nothing to compute → no data
      { [DAY]: "2026-01-02", "FeedbackRecords.npsScore": null },
      // Invented bucket: nobody answered, so there is no NPS to report. A 0 here is a real score
      // (as many detractors as promoters) and would pull the line down to the baseline.
      { [DAY]: "2026-01-03", "FeedbackRecords.npsScore": null },
    ]);
  });

  test("splits an invented bucket by measure: the count is 0, the ratio beside it stays null", async () => {
    const DAY = "FeedbackRecords.collectedAt.day";
    mockTablePivot.mockImplementation((pivotConfig?: { fillMissingDates?: boolean }) => {
      const real = [{ [DAY]: "2026-01-01", "FeedbackRecords.count": 12, "FeedbackRecords.npsScore": "50" }];
      if (pivotConfig?.fillMissingDates === false) return real;
      return [
        ...real,
        {
          [DAY]: "2026-01-02",
          "FeedbackRecords.count": "__formbricks_null__",
          "FeedbackRecords.npsScore": "__formbricks_null__",
        },
      ];
    });

    const { executeTenantScopedQuery } = await import("./cube-client");
    const result = await executeTenantScopedQuery({
      ...scopedInput,
      query: {
        measures: ["FeedbackRecords.count", "FeedbackRecords.npsScore"],
        timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", granularity: "day" }],
      },
    });

    // One empty day, two answers: it genuinely collected zero responses, and it has no NPS at all.
    expect(result).toEqual([
      { [DAY]: "2026-01-01", "FeedbackRecords.count": 12, "FeedbackRecords.npsScore": "50" },
      { [DAY]: "2026-01-02", "FeedbackRecords.count": 0, "FeedbackRecords.npsScore": null },
    ]);
  });

  test("fetches the response base alongside a score and counts 0 answers in an invented bucket", async () => {
    const WEEK = "FeedbackRecords.collectedAt.week";
    mockTablePivot.mockImplementation((pivotConfig?: { fillMissingDates?: boolean }) => {
      const real = [
        { [WEEK]: "2026-01-05", "FeedbackRecords.npsScore": "40", "FeedbackRecords.npsCount": 25 },
      ];
      if (pivotConfig?.fillMissingDates === false) return real;
      return [
        ...real,
        {
          [WEEK]: "2026-01-12",
          "FeedbackRecords.npsScore": "__formbricks_null__",
          "FeedbackRecords.npsCount": "__formbricks_null__",
        },
      ];
    });

    const { executeTenantScopedQuery } = await import("./cube-client");
    const query = {
      measures: ["FeedbackRecords.npsScore"],
      timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", granularity: "week" as const }],
    };
    const result = await executeTenantScopedQuery({ ...scopedInput, query });

    expect(mockLoad).toHaveBeenCalledWith(
      {
        ...query,
        measures: ["FeedbackRecords.npsScore", "FeedbackRecords.npsCount"],
        timezone: "UTC",
      },
      expect.anything()
    );
    // A week nobody answered has no score, but it genuinely had zero answers.
    expect(result).toEqual([
      { [WEEK]: "2026-01-05", "FeedbackRecords.npsScore": "40", "FeedbackRecords.npsCount": 25 },
      { [WEEK]: "2026-01-12", "FeedbackRecords.npsScore": null, "FeedbackRecords.npsCount": 0 },
    ]);
    expect(query.measures).toEqual(["FeedbackRecords.npsScore"]);
    // The audit trail records the chart as the user built it, not the injected member.
    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        newObject: expect.objectContaining({
          query: expect.objectContaining({ measures: ["FeedbackRecords.npsScore"] }),
        }),
      })
    );
  });

  test("still renders the chart when Cube does not know the response base measure", async () => {
    // A self-hosted Cube running an older schema has no npsCount.
    mockLoad
      .mockRejectedValueOnce(new Error("Error: 'npsCount' not found for path 'FeedbackRecords.npsCount'"))
      .mockResolvedValueOnce(stubResultSet());
    mockTablePivot.mockReturnValue([{ "FeedbackRecords.npsScore": "40" }]);

    const { executeTenantScopedQuery } = await import("./cube-client");
    const query = { measures: ["FeedbackRecords.npsScore"] };
    const result = await executeTenantScopedQuery({ ...scopedInput, query });

    expect(mockLoad).toHaveBeenNthCalledWith(
      1,
      { measures: ["FeedbackRecords.npsScore", "FeedbackRecords.npsCount"], timezone: "UTC" },
      expect.anything()
    );
    expect(mockLoad).toHaveBeenNthCalledWith(2, { ...query, timezone: "UTC" }, expect.anything());
    expect(result).toEqual([{ "FeedbackRecords.npsScore": "40" }]);
    expect(mockLoggerWarn).toHaveBeenCalledWith(expect.any(Error), expect.stringContaining("response base"));
  });

  test("does not retry when the error is not about the injected measure", async () => {
    // A timeout or a failure in the chart's own members would fail again; retrying only doubles the
    // load on a Cube that is already struggling.
    mockLoad.mockRejectedValue(new Error("Query timeout of 60000ms exceeded"));
    const { executeTenantScopedQuery } = await import("./cube-client");
    await expect(
      executeTenantScopedQuery({ ...scopedInput, query: { measures: ["FeedbackRecords.npsScore"] } })
    ).rejects.toThrow(/Cube query failed/);
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  test("does not retry a failed query that carried no response base", async () => {
    mockLoad.mockRejectedValue(new Error("boom"));
    const { executeTenantScopedQuery } = await import("./cube-client");
    await expect(
      executeTenantScopedQuery({ ...scopedInput, query: { measures: ["FeedbackRecords.count"] } })
    ).rejects.toThrow(/Cube query failed/);
    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  test("leaves a query with no single response base untouched", async () => {
    const { executeTenantScopedQuery } = await import("./cube-client");
    const query = { measures: ["FeedbackRecords.npsScore", "FeedbackRecords.count"] };
    await executeTenantScopedQuery({ ...scopedInput, query });
    expect(mockLoad).toHaveBeenCalledWith({ ...query, timezone: "UTC" }, expect.anything());
  });

  test("keeps a zero-activity day as 0 when every empty bucket was synthesized", async () => {
    const DAY = "FeedbackRecords.collectedAt.day";
    mockTablePivot.mockImplementation((pivotConfig?: { fillMissingDates?: boolean }) => {
      const real = [{ [DAY]: "2026-01-01", "FeedbackRecords.count": 12 }];
      if (pivotConfig?.fillMissingDates === false) return real;
      return [...real, { [DAY]: "2026-01-02", "FeedbackRecords.count": "__formbricks_null__" }];
    });

    const { executeTenantScopedQuery } = await import("./cube-client");
    const result = await executeTenantScopedQuery({
      ...scopedInput,
      query: {
        measures: ["FeedbackRecords.count"],
        timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", granularity: "day" }],
      },
    });

    expect(result).toEqual([
      { [DAY]: "2026-01-01", "FeedbackRecords.count": 12 },
      { [DAY]: "2026-01-02", "FeedbackRecords.count": 0 },
    ]);
  });

  test("still restores nulls for a time dimension used only as a filter, with no granularity", async () => {
    mockTablePivot.mockReturnValue([{ "FeedbackRecords.npsScore": "__formbricks_null__" }]);
    const { executeTenantScopedQuery } = await import("./cube-client");
    const result = await executeTenantScopedQuery({
      ...scopedInput,
      query: {
        measures: ["FeedbackRecords.npsScore"],
        timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", dateRange: "last 30 days" }],
      },
    });

    expect(mockTablePivot).toHaveBeenCalledWith({ fillWithValue: "__formbricks_null__" });
    expect(result).toEqual([{ "FeedbackRecords.npsScore": null }]);
  });

  test("leaves rows without a sentinel exactly as the pivot returned them", async () => {
    const rows = [{ "FeedbackRecords.count": 42 }];
    mockTablePivot.mockReturnValue(rows);
    const { executeTenantScopedQuery } = await import("./cube-client");
    const result = await executeTenantScopedQuery(scopedInput);

    expect(result).toEqual(rows);
  });

  test("does not cache tenant-bearing Cube clients or tokens", async () => {
    const { executeTenantScopedQuery } = await import("./cube-client");

    await executeTenantScopedQuery(scopedInput);
    await executeTenantScopedQuery({ ...scopedInput, feedbackDirectoryId: "frd-2" });

    const cubejs = await getCubeJsMock();
    expect(cubejs).toHaveBeenCalledTimes(2);
    expect(cubejs.mock.calls[0][0]).not.toBe(cubejs.mock.calls[1][0]);
  });

  test("rejects caller-supplied tenant filters before creating a Cube client", async () => {
    const { executeTenantScopedQuery } = await import("./cube-client");

    await expect(
      executeTenantScopedQuery({
        ...scopedInput,
        query: {
          measures: ["FeedbackRecords.count"],
          filters: [{ member: "FeedbackRecords.tenantId", operator: "equals", values: ["workspace-2"] }],
        },
      })
    ).rejects.toThrow(/Tenant filters are enforced by Cube/);

    const cubejs = await getCubeJsMock();
    expect(cubejs).not.toHaveBeenCalled();
    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "queried",
        targetType: "cubeQuery",
        requestMetadata: { ipAddress: "203.0.113.7", userAgent: "cube-test-agent" },
        status: "failure",
        newObject: expect.objectContaining({
          tenantId: "frd-1",
          feedbackDirectoryId: "frd-1",
          workspaceId: "workspace-1",
          query: expect.objectContaining({
            filterMembers: ["FeedbackRecords.tenantId"],
            filterCount: 1,
          }),
          errorName: "Error",
        }),
      })
    );
  });

  test("preserves API URL when it already contains /cubejs-api/v1", async () => {
    const fullUrl = "https://cube.example.com/cubejs-api/v1";
    vi.stubEnv("CUBEJS_API_URL", fullUrl);
    const { executeTenantScopedQuery } = await import("./cube-client");

    await executeTenantScopedQuery(scopedInput);

    const cubejs = await getCubeJsMock();
    expect(cubejs).toHaveBeenCalledWith(expect.any(String), {
      apiUrl: fullUrl,
      signal: expect.any(AbortSignal),
    });
  });

  test("fails at env validation when Cube env is missing", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/formbricks?schema=public");
    vi.stubEnv("ENCRYPTION_KEY", "12345678901234567890123456789012");
    vi.stubEnv("HUB_API_URL", "https://hub.formbricks.local");
    vi.stubEnv("HUB_API_KEY", "test-hub-api-key");
    vi.stubEnv("CUBEJS_API_URL", undefined);
    vi.stubEnv("CUBEJS_API_SECRET", undefined);

    await expect(import("./cube-client")).rejects.toThrow("Invalid environment variables");
  });

  test("logs Cube runtime failures and returns a generic query execution error", async () => {
    mockLoad.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    const { CubeQueryError, executeTenantScopedQuery } = await import("./cube-client");

    const failure = executeTenantScopedQuery(scopedInput);
    await expect(failure).rejects.toThrow(
      "Cube query failed. Verify CUBEJS_API_URL and CUBEJS_API_SECRET, and ensure the Cube service is running."
    );
    await expect(failure).rejects.toBeInstanceOf(CubeQueryError);
    await expect(failure).rejects.toMatchObject({ timedOut: false });
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error), timedOut: false }),
      "Cube query failed"
    );
  });

  // ENG-6582: one deadline covers the whole load, every "Continue wait" poll included, and running out
  // of it surfaces as the same generic failure — never Cube's own error.
  test("gives every query one shared deadline and reports running out of it as a timeout", async () => {
    // Fake timers do not drive `AbortSignal.timeout`, so the deadline is handed a controller to fire.
    const deadline = new AbortController();
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    const { CUBE_QUERY_TIMEOUT_MS, executeTenantScopedQuery } = await import("./cube-client");
    const cubejs = await getCubeJsMock();
    mockLoad.mockImplementationOnce(() => {
      const { signal } = cubejs.mock.calls[0][1] as unknown as { signal: AbortSignal };
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("Cube said: SELECT … timed out")));
      });
    });

    const failure = executeTenantScopedQuery(scopedInput);
    await vi.waitFor(() => expect(mockLoad).toHaveBeenCalled());
    deadline.abort(new DOMException("timed out", "TimeoutError"));

    await expect(failure).rejects.toMatchObject({ name: "CubeQueryError", timedOut: true });
    await expect(failure).rejects.not.toThrow(/SELECT/);
    expect(timeoutSpy).toHaveBeenCalledWith(CUBE_QUERY_TIMEOUT_MS);
  });

  test("attributes an API-key query to the key in the token and the audit event", async () => {
    const { executeTenantScopedQuery } = await import("./cube-client");

    await executeTenantScopedQuery({ ...scopedInput, actor: { type: "apiKey", id: "key-1" } });

    const cubejs = await getCubeJsMock();
    const payload = jwt.decode(cubejs.mock.calls[0][0]) as jwt.JwtPayload;
    expect(payload).toMatchObject({ apiKeyId: "key-1" });
    expect(payload).not.toHaveProperty("userId");
    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "key-1",
        userType: "api",
        newObject: expect.objectContaining({ actor: { type: "apiKey", id: "key-1" } }),
      })
    );
  });

  test("records sanitized audit metadata without raw filter values", async () => {
    const { executeTenantScopedQuery } = await import("./cube-client");

    await executeTenantScopedQuery({
      ...scopedInput,
      query: {
        measures: ["FeedbackRecords.count"],
        filters: [{ member: "FeedbackRecords.sourceType", operator: "equals", values: ["secret-value"] }],
      },
    });

    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "queried",
        targetType: "cubeQuery",
        requestMetadata: { ipAddress: "203.0.113.7", userAgent: "cube-test-agent" },
        newObject: expect.objectContaining({
          query: expect.objectContaining({
            filterMembers: ["FeedbackRecords.sourceType"],
            filterCount: 1,
          }),
        }),
      })
    );
    expect(JSON.stringify(mockQueueAuditEventWithoutRequest.mock.calls[0][0])).not.toContain("secret-value");
  });

  test("handles audit logging failures without failing the Cube query", async () => {
    mockQueueAuditEventWithoutRequest.mockRejectedValueOnce(new Error("audit unavailable"));
    const { executeTenantScopedQuery } = await import("./cube-client");

    await expect(executeTenantScopedQuery(scopedInput)).resolves.toEqual([{ id: "1", count: 42 }]);

    await vi.waitFor(() => {
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.any(Error),
        "Failed to queue Cube query audit event"
      );
    });
  });

  describe("time-bucket cap (ENG-6603)", () => {
    const hourly = "FeedbackRecords.collectedAt.hour";

    /** A real Cube result for an hourly count, echoing `dateRange` as Cube normalizes it. */
    const hourlyLoadResponse = (dateRange: [string, string] | undefined, hours: string[]) => {
      const query = {
        measures: ["FeedbackRecords.count"],
        timeDimensions: [
          {
            dimension: "FeedbackRecords.collectedAt",
            granularity: "hour",
            ...(dateRange ? { dateRange } : {}),
          },
        ],
      };
      return {
        queryType: "regularQuery",
        pivotQuery: { ...query, queryType: "regularQuery" },
        results: [
          {
            query,
            annotation: {
              measures: { "FeedbackRecords.count": { type: "number" } },
              dimensions: {},
              segments: {},
              timeDimensions: { [hourly]: { type: "time" } },
            },
            data: hours.map((hour) => ({
              [hourly]: hour,
              "FeedbackRecords.collectedAt": hour,
              "FeedbackRecords.count": "1",
            })),
          },
        ],
      };
    };

    const runHourly = async (loadResponse: unknown) => {
      const transport = createCubeTransport(loadResponse);
      const { CubeApi } = await vi.importActual<typeof CubeClient>("@cubejs-client/core");
      mockLoad.mockImplementationOnce((query: CubeClient.Query, options?: CubeClient.LoadMethodOptions) =>
        new CubeApi("token", { apiUrl: "https://cube.example.com/cubejs-api/v1", transport }).load(
          query,
          options
        )
      );
      const { executeTenantScopedQuery } = await import("./cube-client");
      return executeTenantScopedQuery({
        ...scopedInput,
        query: {
          measures: ["FeedbackRecords.count"],
          timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", granularity: "hour" }],
        },
      });
    };

    test("fills every empty bucket of a range within the cap", async () => {
      const rows = await runHourly(
        hourlyLoadResponse(
          ["2024-01-01T00:00:00.000", "2024-01-02T23:59:59.999"],
          ["2024-01-01T05:00:00.000"]
        )
      );

      expect(rows).toHaveLength(48);
      expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    test("returns only the real rows when the requested range spans more buckets than the cap", async () => {
      // 50 years by the hour is ~438,000 buckets; filled, it would build a row for each of them.
      const rows = await runHourly(
        hourlyLoadResponse(
          ["2000-01-01T00:00:00.000", "2049-12-31T23:59:59.999"],
          ["2024-01-01T05:00:00.000"]
        )
      );

      expect(rows).toEqual([{ [hourly]: "2024-01-01T05:00:00.000", "FeedbackRecords.count": 1 }]);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.objectContaining({ maxTimeBuckets: 10_000 }),
        "Chart query spans more time buckets than the cap; empty buckets are not filled"
      );
    });

    test("caps an all-time chart by the span of its rows", async () => {
      // No date range: the pivot fills from the earliest row to the latest, ~1.1 million hours here.
      const rows = await runHourly(
        hourlyLoadResponse(undefined, ["1900-01-01T00:00:00.000", "2024-01-01T05:00:00.000"])
      );

      expect(rows).toHaveLength(2);
    });
  });
});
