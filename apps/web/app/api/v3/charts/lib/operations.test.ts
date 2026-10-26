import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import {
  refuseUnlessFeedbackDatasetAccess,
  requireDashboardsAccess,
} from "@/app/api/v3/lib/dashboards-access";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { capturePostHogEvent } from "@/lib/posthog";
import { isNewReleaseWorkEnabled } from "@/lib/upgrade/compatibility";
import { createV3Chart, deleteV3Chart, getV3Chart, listV3Charts, updateV3Chart } from "./operations";
import { ZV3ChartResource } from "./resources";
import {
  type TChartResourceRow,
  createChartRow,
  deleteChartRow,
  getChartResourceRow,
  listChartResourceRows,
  updateChartRow,
} from "./service";

vi.mock("server-only", () => ({}));

// vitestSetup stubs createHash to a constant; the cursor's filter fingerprint needs the real one.
vi.mock("node:crypto", async (importOriginal) => await importOriginal());

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

vi.mock("@/app/api/v3/lib/dashboards-access", () => ({
  requireDashboardsAccess: vi.fn(),
  refuseUnlessFeedbackDatasetAccess: vi.fn(),
}));

vi.mock("./service", () => ({
  getChartResourceRow: vi.fn(),
  listChartResourceRows: vi.fn(),
  createChartRow: vi.fn(),
  updateChartRow: vi.fn(),
  deleteChartRow: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/lib/upgrade/compatibility", () => ({ isNewReleaseWorkEnabled: vi.fn() }));

const workspaceId = "clws000000000000000000001";
const internalWorkspaceId = "clws000000000000000000009";
const organizationId = "clorg00000000000000000001";
const datasetId = "clds000000000000000000001";
const chartId = "clch000000000000000000001";
const requestId = "req_1";
const instance = "/api/v3/charts";

const session = { user: { id: "user_1" } } as unknown as TV3Authentication;
const apiKey = { apiKeyId: "key_1", workspacePermissions: [] } as unknown as TV3Authentication;
const access = { workspaceId: internalWorkspaceId, organizationId };
const VALID_QUERY = { measures: ["FeedbackRecords.count"] };

const rowOf = (overrides: Partial<TChartResourceRow> = {}): TChartResourceRow =>
  ({
    id: chartId,
    workspaceId: internalWorkspaceId,
    feedbackDirectoryId: datasetId,
    name: "NPS by month",
    type: "bar",
    query: VALID_QUERY,
    config: { showLegend: true },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    creator: { name: "Ada" },
    widgets: [{ dashboard: { id: "cldb000000000000000000001", name: "Alpha" } }],
    ...overrides,
  }) as TChartResourceRow;

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("prisma failure", { code, clientVersion: "7" });

type TProblem = {
  status: number;
  code: string;
  detail?: string;
  invalid_params?: { name: string; reason: string; code?: string }[];
  details?: Record<string, unknown>;
};
const problemOf = async (response: Response) => (await response.json()) as TProblem;
const dataOf = async <T = Record<string, unknown>>(response: Response) =>
  ((await response.json()) as { data: T }).data;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireDashboardsAccess).mockResolvedValue(access);
  vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValue(null);
  vi.mocked(isNewReleaseWorkEnabled).mockResolvedValue(true);
  vi.mocked(getChartResourceRow).mockResolvedValue(rowOf());
});

describe("listV3Charts", () => {
  const list = (query: Record<string, unknown> = {}, authentication: TV3Authentication = session) =>
    listV3Charts({
      query: { workspaceId, limit: 2, ...query } as never,
      authentication,
      requestId,
      instance,
    });

  test("returns the gate's refusal without reading any chart", async () => {
    vi.mocked(requireDashboardsAccess).mockResolvedValue(problemForbidden(requestId, undefined, instance));

    const response = await list();

    expect(response.status).toBe(403);
    expect(requireDashboardsAccess).toHaveBeenCalledWith(session, workspaceId, "read", requestId, instance);
    expect(listChartResourceRows).not.toHaveBeenCalled();
  });

  test("reads the authorized workspace with the filters and serializes each chart", async () => {
    vi.mocked(listChartResourceRows).mockResolvedValue([rowOf()]);

    const response = await list({ "filter[name][contains]": "nps", "filter[datasetId][eq]": datasetId });

    expect(response.status).toBe(200);
    expect(listChartResourceRows).toHaveBeenCalledWith({
      filter: { workspaceId: internalWorkspaceId, nameContains: "nps", datasetId },
      cursor: null,
      limit: 2,
    });
    const body = (await response.json()) as { data: unknown[]; meta: unknown };
    expect(body.meta).toEqual({ limit: 2, nextCursor: null });
    expect(body.data).toHaveLength(1);
    expect(ZV3ChartResource.parse(body.data[0])).toEqual({
      id: chartId,
      workspaceId: internalWorkspaceId,
      datasetId,
      name: "NPS by month",
      type: "bar",
      query: VALID_QUERY,
      config: { showLegend: true },
      creator: { name: "Ada" },
      dashboards: [{ id: "cldb000000000000000000001", name: "Alpha" }],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  test("hands out a cursor when another page follows, and resumes after the last chart with it", async () => {
    const rows = [
      rowOf({ id: "clch000000000000000000003", createdAt: new Date("2026-03-01T00:00:00.000Z") }),
      rowOf({ id: "clch000000000000000000002", createdAt: new Date("2026-02-01T00:00:00.000Z") }),
      rowOf({ id: "clch000000000000000000001", createdAt: new Date("2026-01-01T00:00:00.000Z") }),
    ];
    vi.mocked(listChartResourceRows).mockResolvedValueOnce(rows);

    const first = (await (await list()).json()) as {
      data: { id: string }[];
      meta: { nextCursor: string | null };
    };
    expect(first.data.map((chart) => chart.id)).toEqual([
      "clch000000000000000000003",
      "clch000000000000000000002",
    ]);
    expect(first.meta.nextCursor).toEqual(expect.any(String));

    vi.mocked(listChartResourceRows).mockResolvedValueOnce([rows[2]]);
    const second = await list({ cursor: first.meta.nextCursor });

    expect(second.status).toBe(200);
    expect(vi.mocked(listChartResourceRows).mock.calls[1][0].cursor).toMatchObject({
      value: "2026-02-01T00:00:00.000Z",
      id: "clch000000000000000000002",
    });
    expect(((await second.json()) as { meta: unknown }).meta).toEqual({ limit: 2, nextCursor: null });
  });

  test("refuses a cursor minted for another filter set, or one that is not a cursor, with 400 naming it", async () => {
    vi.mocked(listChartResourceRows).mockResolvedValueOnce([
      rowOf({ id: "clch000000000000000000002" }),
      rowOf({ id: "clch000000000000000000001" }),
      rowOf({ id: "clch000000000000000000000" }),
    ]);
    const { meta } = (await (await list()).json()) as { meta: { nextCursor: string } };
    vi.mocked(listChartResourceRows).mockClear();

    for (const [query, reason] of [
      [
        { cursor: meta.nextCursor, "filter[name][contains]": "other" },
        "The cursor was issued for a different filter set.",
      ],
      [{ cursor: "not-a-cursor" }, "The cursor is invalid."],
    ] as const) {
      const response = await list(query);
      expect(response.status).toBe(400);
      const problem = await problemOf(response);
      expect(problem.code).toBe("bad_request");
      expect(problem.invalid_params).toEqual([{ name: "cursor", reason }]);
    }
    expect(listChartResourceRows).not.toHaveBeenCalled();
  });

  test("answers an unexpected failure with a 500 that does not echo it", async () => {
    vi.mocked(listChartResourceRows).mockRejectedValue(new Error("relation secret_table does not exist"));

    const response = await list();

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret_table");
  });
});

describe("getV3Chart", () => {
  const get = (authentication: TV3Authentication = session) =>
    getV3Chart({ chartId, authentication, requestId, instance });

  test("authorizes the chart's own workspace for read and returns it", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(getChartResourceRow).toHaveBeenCalledWith(chartId);
    expect(requireDashboardsAccess).toHaveBeenCalledWith(
      session,
      internalWorkspaceId,
      "read",
      requestId,
      instance
    );
    expect(await dataOf(response)).toMatchObject({ id: chartId, datasetId, name: "NPS by month" });
  });

  test("answers a missing chart with the same 403 as a forbidden one, without checking access", async () => {
    vi.mocked(getChartResourceRow).mockResolvedValue(null);

    const response = await get();

    expect(response.status).toBe(403);
    expect((await problemOf(response)).code).toBe("forbidden");
    expect(requireDashboardsAccess).not.toHaveBeenCalled();
  });

  test("passes the access gate's refusal through", async () => {
    vi.mocked(requireDashboardsAccess).mockResolvedValue(new Response(null, { status: 401 }));

    expect((await get()).status).toBe(401);
  });

  test("maps a failed read to 500", async () => {
    vi.mocked(getChartResourceRow).mockRejectedValue(new Error("boom"));

    expect((await get()).status).toBe(500);
  });
});

describe("createV3Chart", () => {
  const body = {
    workspaceId,
    datasetId,
    name: "Weekly NPS",
    type: "bar" as const,
    query: VALID_QUERY,
  };
  const create = (
    overrides: Record<string, unknown> = {},
    authentication: TV3Authentication = session,
    auditLog?: TV3AuditLog
  ) =>
    createV3Chart({
      body: { ...body, ...overrides } as never,
      authentication,
      requestId,
      instance,
      auditLog,
    });

  beforeEach(() => {
    vi.mocked(createChartRow).mockResolvedValue(rowOf({ name: "Weekly NPS", widgets: [] }));
  });

  test("creates the chart in the authorized workspace, audited, with a Location", async () => {
    const auditLog = {} as TV3AuditLog;

    const response = await create({ config: { showLegend: false } }, session, auditLog);

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/v3/charts/${chartId}`);
    expect(requireDashboardsAccess).toHaveBeenCalledWith(
      session,
      workspaceId,
      "readWrite",
      requestId,
      instance
    );
    expect(refuseUnlessFeedbackDatasetAccess).toHaveBeenCalledWith(
      session,
      access,
      datasetId,
      "readWrite",
      requestId,
      instance
    );
    expect(createChartRow).toHaveBeenCalledWith({
      workspaceId: internalWorkspaceId,
      datasetId,
      name: "Weekly NPS",
      type: "bar",
      query: VALID_QUERY,
      config: { showLegend: false },
      createdBy: "user_1",
    });
    const chart = await dataOf(response);
    expect(chart).toMatchObject({ id: chartId, name: "Weekly NPS", dashboards: [] });
    expect(auditLog).toMatchObject({ targetId: chartId, organizationId, newObject: chart });
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      "user_1",
      "chart_created",
      { chart_id: chartId },
      { organizationId, workspaceId: internalWorkspaceId }
    );
  });

  test("stores the query as the validator returns it, with all-time as no range", async () => {
    await create({
      query: {
        measures: ["FeedbackRecords.count"],
        timeDimensions: [
          { dimension: "FeedbackRecords.collectedAt", granularity: "week", dateRange: "all-time" },
        ],
      },
    });

    expect(vi.mocked(createChartRow).mock.calls[0][0].query).toEqual({
      measures: ["FeedbackRecords.count"],
      timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", granularity: "week" }],
    });
  });

  test("records an API key's chart with no creator, empty config, and no product event", async () => {
    const response = await create({}, apiKey);

    expect(response.status).toBe(201);
    expect(createChartRow).toHaveBeenCalledWith(expect.objectContaining({ createdBy: null, config: {} }));
    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });

  test("returns the workspace gate's refusal without checking the dataset", async () => {
    vi.mocked(requireDashboardsAccess).mockResolvedValue(problemForbidden(requestId, undefined, instance));

    expect((await create()).status).toBe(403);
    expect(refuseUnlessFeedbackDatasetAccess).not.toHaveBeenCalled();
    expect(createChartRow).not.toHaveBeenCalled();
  });

  test("returns the dataset refusal and creates nothing", async () => {
    vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValue(
      problemForbidden(requestId, "You are not authorized to use this Feedback Dataset", instance)
    );

    const response = await create();

    expect(response.status).toBe(403);
    expect(createChartRow).not.toHaveBeenCalled();
  });

  test("refuses a query the validator rejects with 422 naming every problem", async () => {
    const response = await create({
      query: { measures: ["FeedbackRecords.tenantId"], ungrouped: true },
    });

    expect(response.status).toBe(422);
    const problem = await problemOf(response);
    expect(problem.code).toBe("unprocessable_content");
    expect(problem.invalid_params?.map((param) => param.name).sort()).toEqual(
      ["query.measures[0]", "query.ungrouped"].sort()
    );
    expect(createChartRow).not.toHaveBeenCalled();
  });

  test("refuses a matrix chart until the online upgrade has finished, and allows it after", async () => {
    vi.mocked(isNewReleaseWorkEnabled).mockResolvedValue(false);

    const refused = await create({ type: "matrix" });
    expect(refused.status).toBe(422);
    expect((await problemOf(refused)).invalid_params?.map((param) => param.name)).toEqual(["type"]);
    expect(createChartRow).not.toHaveBeenCalled();

    // Other types are not gated by the upgrade.
    expect((await create({ type: "pie" })).status).toBe(201);

    vi.mocked(isNewReleaseWorkEnabled).mockResolvedValue(true);
    expect((await create({ type: "matrix" })).status).toBe(201);
  });

  test("answers a name already used in the workspace with 409", async () => {
    vi.mocked(createChartRow).mockRejectedValue(prismaError("P2002"));

    const response = await create();

    expect(response.status).toBe(409);
    const problem = await problemOf(response);
    expect(problem.code).toBe("conflict");
    expect(problem.detail).toBe("A chart with this name already exists in this workspace.");
    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });

  test("answers any other write failure with 500", async () => {
    vi.mocked(createChartRow).mockRejectedValue(prismaError("P2003"));

    expect((await create()).status).toBe(500);
  });
});

describe("updateV3Chart", () => {
  const update = (body: Record<string, unknown>, auditLog?: TV3AuditLog) =>
    updateV3Chart({ chartId, body: body as never, authentication: session, requestId, instance, auditLog });

  beforeEach(() => {
    vi.mocked(updateChartRow).mockResolvedValue(rowOf({ name: "Renamed" }));
  });

  test("needs write access to the chart's Feedback Dataset too, and writes nothing without it", async () => {
    await update({ name: "Renamed" });
    expect(refuseUnlessFeedbackDatasetAccess).toHaveBeenCalledWith(
      session,
      expect.objectContaining({ workspaceId: internalWorkspaceId }),
      datasetId,
      "readWrite",
      requestId,
      instance
    );

    vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValueOnce(
      problemForbidden(requestId, "You are not authorized to use this Feedback Dataset", instance)
    );
    const refused = await update({ query: { measures: ["FeedbackRecords.count"] } });
    expect(refused.status).toBe(403);
    expect(updateChartRow).toHaveBeenCalledTimes(1);
  });

  test("keeps a stored relative range when the query comes back unchanged, but not in a new query", async () => {
    const legacy = {
      measures: ["FeedbackRecords.count"],
      timeDimensions: [
        { dimension: "FeedbackRecords.collectedAt", granularity: "month", dateRange: "last 3 months" },
      ],
    };
    vi.mocked(getChartResourceRow).mockResolvedValue(rowOf({ query: legacy }));

    // The editor sends the stored query back with a rename.
    expect((await update({ name: "Renamed", query: structuredClone(legacy) })).status).toBe(200);

    const changed = { ...legacy, dimensions: ["FeedbackRecords.sentiment"] };
    expect((await update({ query: changed })).status).toBe(422);
  });

  test("writes only the fields sent, needs readWrite, and audits before and after", async () => {
    const auditLog = {} as TV3AuditLog;

    const response = await update({ name: "Renamed", config: { showLegend: false } }, auditLog);

    expect(response.status).toBe(200);
    expect(requireDashboardsAccess).toHaveBeenCalledWith(
      session,
      internalWorkspaceId,
      "readWrite",
      requestId,
      instance
    );
    expect(updateChartRow).toHaveBeenCalledWith(chartId, {
      name: "Renamed",
      config: { showLegend: false },
    });
    const chart = await dataOf(response);
    expect(chart).toMatchObject({ name: "Renamed" });
    expect(auditLog).toMatchObject({
      targetId: chartId,
      organizationId,
      oldObject: { name: "NPS by month" },
      newObject: chart,
    });
  });

  test("writes a validated query and a new type", async () => {
    await update({ type: "pie", query: { measures: ["FeedbackRecords.count"], limit: 10 } });

    expect(updateChartRow).toHaveBeenCalledWith(chartId, {
      type: "pie",
      query: { measures: ["FeedbackRecords.count"], limit: 10 },
    });
  });

  test("refuses an empty update with 400 naming the body", async () => {
    const response = await update({});

    expect(response.status).toBe(400);
    expect((await problemOf(response)).invalid_params?.map((param) => param.name)).toEqual(["body"]);
    expect(updateChartRow).not.toHaveBeenCalled();
  });

  test("refuses an invalid query with 422 and writes nothing", async () => {
    const response = await update({ name: "Renamed", query: { measures: ["FeedbackRecords.tenantId"] } });

    expect(response.status).toBe(422);
    expect((await problemOf(response)).invalid_params?.map((param) => param.name)).toEqual([
      "query.measures[0]",
    ]);
    expect(updateChartRow).not.toHaveBeenCalled();
  });

  test("refuses switching to matrix before the upgrade finished", async () => {
    vi.mocked(isNewReleaseWorkEnabled).mockResolvedValue(false);

    const response = await update({ type: "matrix" });

    expect(response.status).toBe(422);
    expect((await problemOf(response)).invalid_params?.map((param) => param.name)).toEqual(["type"]);
    expect(updateChartRow).not.toHaveBeenCalled();
  });

  test("answers a chart that does not exist, or is not the caller's, with 403", async () => {
    vi.mocked(getChartResourceRow).mockResolvedValueOnce(null);
    expect((await update({ name: "Renamed" })).status).toBe(403);

    vi.mocked(requireDashboardsAccess).mockResolvedValueOnce(
      problemForbidden(requestId, undefined, instance)
    );
    expect((await update({ name: "Renamed" })).status).toBe(403);

    expect(updateChartRow).not.toHaveBeenCalled();
  });

  test("maps a taken name to 409, a chart deleted meanwhile to 403, and anything else to 500", async () => {
    vi.mocked(updateChartRow).mockRejectedValueOnce(prismaError("P2002"));
    const taken = await update({ name: "Taken" });
    expect(taken.status).toBe(409);
    expect((await problemOf(taken)).code).toBe("conflict");

    vi.mocked(updateChartRow).mockRejectedValueOnce(prismaError("P2025"));
    const gone = await update({ name: "Renamed" });
    expect(gone.status).toBe(403);
    expect((await problemOf(gone)).code).toBe("forbidden");

    vi.mocked(updateChartRow).mockRejectedValueOnce(new Error("boom"));
    expect((await update({ name: "Renamed" })).status).toBe(500);
  });
});

describe("deleteV3Chart", () => {
  const remove = (auditLog?: TV3AuditLog) =>
    deleteV3Chart({ chartId, authentication: session, requestId, instance, auditLog });

  test("needs write access to the chart's Feedback Dataset too, and deletes nothing without it", async () => {
    vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValueOnce(
      problemForbidden(requestId, "You are not authorized to use this Feedback Dataset", instance)
    );

    expect((await remove()).status).toBe(403);
    expect(refuseUnlessFeedbackDatasetAccess).toHaveBeenCalledWith(
      session,
      expect.objectContaining({ workspaceId: internalWorkspaceId }),
      datasetId,
      "readWrite",
      requestId,
      instance
    );
    expect(deleteChartRow).not.toHaveBeenCalled();
  });

  test("deletes a chart on no dashboard with 204, audited", async () => {
    vi.mocked(deleteChartRow).mockResolvedValue({ kind: "deleted" });
    const auditLog = {} as TV3AuditLog;

    const response = await remove(auditLog);

    expect(response.status).toBe(204);
    expect(requireDashboardsAccess).toHaveBeenCalledWith(
      session,
      internalWorkspaceId,
      "readWrite",
      requestId,
      instance
    );
    expect(deleteChartRow).toHaveBeenCalledWith(chartId);
    expect(auditLog).toMatchObject({ targetId: chartId, organizationId, oldObject: { id: chartId } });
  });

  test("refuses a chart still on dashboards with 409 chart_in_use naming them, unaudited", async () => {
    const dashboards = [
      { id: "cldb000000000000000000001", name: "Alpha" },
      { id: "cldb000000000000000000002", name: "Beta" },
    ];
    vi.mocked(deleteChartRow).mockResolvedValue({ kind: "inUse", dashboards });
    const auditLog = {} as TV3AuditLog;

    const response = await remove(auditLog);

    expect(response.status).toBe(409);
    expect(await problemOf(response)).toMatchObject({ code: "chart_in_use", details: { dashboards } });
    expect(auditLog).toEqual({});
  });

  test("answers a chart deleted since it was loaded with 403", async () => {
    vi.mocked(deleteChartRow).mockResolvedValue({ kind: "gone" });

    const response = await remove();

    expect(response.status).toBe(403);
    expect((await problemOf(response)).code).toBe("forbidden");
  });

  test("deletes nothing for a caller without write access", async () => {
    vi.mocked(requireDashboardsAccess).mockResolvedValue(problemForbidden(requestId, undefined, instance));

    expect((await remove()).status).toBe(403);
    expect(deleteChartRow).not.toHaveBeenCalled();
  });

  test("maps a failed delete to 500", async () => {
    vi.mocked(deleteChartRow).mockRejectedValue(new Error("boom"));

    expect((await remove()).status).toBe(500);
  });
});
