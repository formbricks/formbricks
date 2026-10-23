import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { requireDashboardsAccess } from "@/app/api/v3/lib/dashboards-access";
import { problemDashboardsPlanRequired, problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { capturePostHogEvent } from "@/lib/posthog";
import {
  createV3Dashboard,
  deleteV3Dashboard,
  duplicateV3Dashboard,
  getV3Dashboard,
  listV3Dashboards,
  renameV3Dashboard,
  replaceV3Dashboard,
  updateV3DashboardLayout,
} from "./operations";
import {
  type TDashboardListRow,
  type TDashboardResourceRow,
  createDashboardRow,
  deleteDashboardRow,
  duplicateDashboardRow,
  getDashboardResourceRow,
  getDashboardWorkspaceRow,
  listDashboardRows,
  renameDashboardRow,
} from "./service";
import { type TDashboardReplaceResult, replaceDashboardRow } from "./widget-service";

vi.mock("server-only", () => ({}));
// vitestSetup fakes createHash; the cursor's filter fingerprint needs the real one to round-trip.
vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("@formbricks/database", () => ({ prisma: {} }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));
vi.mock("@/app/api/v3/lib/dashboards-access", () => ({ requireDashboardsAccess: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("./service", () => ({
  createDashboardRow: vi.fn(),
  deleteDashboardRow: vi.fn(),
  duplicateDashboardRow: vi.fn(),
  getDashboardResourceRow: vi.fn(),
  getDashboardWorkspaceRow: vi.fn(),
  listDashboardRows: vi.fn(),
  renameDashboardRow: vi.fn(),
}));
vi.mock("./widget-service", () => ({ replaceDashboardRow: vi.fn() }));

const WORKSPACE_ID = "clws000000000000000000001";
const ORGANIZATION_ID = "clor000000000000000000001";
const DASHBOARD_ID = "clda000000000000000000001";
const COPY_ID = "clda000000000000000000002";
const WIDGET_A = "clwi000000000000000000001";
const WIDGET_B = "clwi000000000000000000002";
const CHART_ID = "clch000000000000000000001";
const USER_ID = "clus000000000000000000001";
const REQUEST_ID = "req_1";
const INSTANCE = "/api/v3/dashboards";

const session = { user: { id: USER_ID } } as never;
const apiKey = { apiKeyId: "key_1", workspacePermissions: [] } as never;
const contextOf = (authentication: never = session) => ({
  authentication,
  requestId: REQUEST_ID,
  instance: INSTANCE,
});

const granted = { workspaceId: WORKSPACE_ID, organizationId: ORGANIZATION_ID };
const refused = () => problemForbidden(REQUEST_ID, undefined, INSTANCE);

const prismaError = (code: PrismaErrorType) =>
  new Prisma.PrismaClientKnownRequestError("prisma", { code, clientVersion: "test" });
const uniqueViolation = () => prismaError(PrismaErrorType.UniqueConstraintViolation);
const recordNotFound = () => prismaError(PrismaErrorType.RecordNotFound);

const chartRow = {
  id: CHART_ID,
  workspaceId: WORKSPACE_ID,
  feedbackDirectoryId: "clds000000000000000000001",
  name: "NPS",
  type: "bar",
  query: { measures: ["FeedbackRecords.count"] },
  config: {},
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  creator: null,
  widgets: [{ dashboard: { id: DASHBOARD_ID, name: "Board" } }],
};

const dashboardRow = (overrides: Partial<TDashboardResourceRow> = {}): TDashboardResourceRow =>
  ({
    id: DASHBOARD_ID,
    workspaceId: WORKSPACE_ID,
    name: "Board",
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-02-02T00:00:00.000Z"),
    creator: { name: "Editor" },
    widgets: [
      { id: WIDGET_A, chartId: CHART_ID, layout: { x: 0, y: 0, w: 6, h: 4 }, order: 0, chart: chartRow },
    ],
    ...overrides,
  }) as TDashboardResourceRow;

const listRow = (id: string, createdAt: string, widgetCount = 0): TDashboardListRow =>
  ({
    id,
    workspaceId: WORKSPACE_ID,
    name: `Board ${id}`,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
    creator: null,
    _count: { widgets: widgetCount },
  }) as TDashboardListRow;

const auditLog = () => ({}) as TV3AuditLog;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireDashboardsAccess).mockResolvedValue(granted);
});

describe("listV3Dashboards", () => {
  const list = (query: Record<string, unknown> = {}) =>
    listV3Dashboards({ query: { workspaceId: WORKSPACE_ID, limit: 2, ...query }, ...contextOf() });

  test("returns the access refusal and reads nothing", async () => {
    vi.mocked(requireDashboardsAccess).mockResolvedValue(refused());

    const response = await list();

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("forbidden");
    expect(requireDashboardsAccess).toHaveBeenCalledWith(session, WORKSPACE_ID, "read", REQUEST_ID, INSTANCE);
    expect(listDashboardRows).not.toHaveBeenCalled();
  });

  test("scopes the read to the authorized workspace and serializes a widget count", async () => {
    vi.mocked(requireDashboardsAccess).mockResolvedValue({ ...granted, workspaceId: "clws_resolved" });
    vi.mocked(listDashboardRows).mockResolvedValue([listRow(DASHBOARD_ID, "2026-03-01T00:00:00.000Z", 3)]);

    const response = await list({ "filter[name][contains]": "event", "filter[chartId][eq]": CHART_ID });

    expect(response.status).toBe(200);
    expect(listDashboardRows).toHaveBeenCalledWith({
      filter: { workspaceId: "clws_resolved", nameContains: "event", chartId: CHART_ID },
      cursor: null,
      limit: 2,
    });
    const body = await response.json();
    expect(body.meta).toEqual({ limit: 2, nextCursor: null });
    expect(body.data).toEqual([
      {
        id: DASHBOARD_ID,
        workspaceId: WORKSPACE_ID,
        name: `Board ${DASHBOARD_ID}`,
        creator: null,
        widgetCount: 3,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
    ]);
  });

  test("trims the extra row into a cursor that resumes after the last row of the page", async () => {
    vi.mocked(listDashboardRows).mockResolvedValueOnce([
      listRow("clda00000000000000000000c", "2026-03-03T00:00:00.000Z"),
      listRow("clda00000000000000000000b", "2026-03-02T00:00:00.000Z"),
      listRow("clda00000000000000000000a", "2026-03-01T00:00:00.000Z"),
    ]);

    const first = await (await list()).json();
    expect(first.data.map((row: { id: string }) => row.id)).toEqual([
      "clda00000000000000000000c",
      "clda00000000000000000000b",
    ]);
    expect(first.meta.nextCursor).toEqual(expect.any(String));

    vi.mocked(listDashboardRows).mockResolvedValueOnce([]);
    const second = await list({ cursor: first.meta.nextCursor });

    expect(second.status).toBe(200);
    expect(vi.mocked(listDashboardRows).mock.calls[1][0].cursor).toMatchObject({
      value: "2026-03-02T00:00:00.000Z",
      id: "clda00000000000000000000b",
    });
  });

  test("refuses a cursor minted for another filter set with 400 naming the cursor", async () => {
    vi.mocked(listDashboardRows).mockResolvedValueOnce([
      listRow("clda00000000000000000000c", "2026-03-03T00:00:00.000Z"),
      listRow("clda00000000000000000000b", "2026-03-02T00:00:00.000Z"),
      listRow("clda00000000000000000000a", "2026-03-01T00:00:00.000Z"),
    ]);
    const { meta } = await (await list()).json();

    const response = await list({ cursor: meta.nextCursor, "filter[name][contains]": "other" });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("bad_request");
    expect(body.invalid_params).toEqual([
      { name: "cursor", reason: "The cursor was issued for a different filter set." },
    ]);
    expect(listDashboardRows).toHaveBeenCalledTimes(1);
  });

  test("refuses a malformed cursor with 400", async () => {
    const response = await list({ cursor: "not-a-cursor" });

    expect(response.status).toBe(400);
    expect((await response.json()).invalid_params).toEqual([
      { name: "cursor", reason: "The cursor is invalid." },
    ]);
    expect(listDashboardRows).not.toHaveBeenCalled();
  });

  test("maps an unexpected failure to a 500 that does not echo it", async () => {
    vi.mocked(listDashboardRows).mockRejectedValue(new Error("relation Dashboard does not exist"));

    const response = await list();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe("internal_server_error");
    expect(JSON.stringify(body)).not.toContain("relation Dashboard");
  });
});

describe("getV3Dashboard", () => {
  const get = () => getV3Dashboard({ dashboardId: DASHBOARD_ID, ...contextOf() });

  test("answers 403 for a dashboard that does not exist", async () => {
    vi.mocked(getDashboardResourceRow).mockResolvedValue(null);

    const response = await get();

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("forbidden");
    expect(requireDashboardsAccess).not.toHaveBeenCalled();
  });

  test("authorizes read on the dashboard's own workspace and returns its widgets with their charts", async () => {
    vi.mocked(getDashboardResourceRow).mockResolvedValue(dashboardRow({ workspaceId: "clws_row" }));

    const response = await get();

    expect(response.status).toBe(200);
    expect(getDashboardResourceRow).toHaveBeenCalledWith(DASHBOARD_ID);
    expect(requireDashboardsAccess).toHaveBeenCalledWith(session, "clws_row", "read", REQUEST_ID, INSTANCE);
    const { data } = await response.json();
    expect(data).toMatchObject({
      id: DASHBOARD_ID,
      name: "Board",
      creator: { name: "Editor" },
      createdAt: "2026-02-01T00:00:00.000Z",
    });
    expect(data.widgets).toEqual([
      {
        id: WIDGET_A,
        chartId: CHART_ID,
        layout: { x: 0, y: 0, w: 6, h: 4 },
        order: 0,
        chart: expect.objectContaining({ id: CHART_ID, dashboards: [{ id: DASHBOARD_ID, name: "Board" }] }),
      },
    ]);
  });

  test("passes a plan refusal through", async () => {
    vi.mocked(getDashboardResourceRow).mockResolvedValue(dashboardRow());
    vi.mocked(requireDashboardsAccess).mockResolvedValue(problemDashboardsPlanRequired(REQUEST_ID));

    const response = await get();

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("dashboards_plan_required");
  });

  test("maps a failed read to 500", async () => {
    vi.mocked(getDashboardResourceRow).mockRejectedValue(new Error("boom"));

    expect((await get()).status).toBe(500);
  });
});

describe("createV3Dashboard", () => {
  const create = (authentication: never = session, log?: TV3AuditLog) =>
    createV3Dashboard({
      body: { workspaceId: WORKSPACE_ID, name: "Board" },
      auditLog: log,
      ...contextOf(authentication),
    });

  test("needs write access and writes nothing without it", async () => {
    vi.mocked(requireDashboardsAccess).mockResolvedValue(refused());

    const response = await create();

    expect(response.status).toBe(403);
    expect(requireDashboardsAccess).toHaveBeenCalledWith(
      session,
      WORKSPACE_ID,
      "readWrite",
      REQUEST_ID,
      INSTANCE
    );
    expect(createDashboardRow).not.toHaveBeenCalled();
  });

  test("creates in the authorized workspace, answers 201 with Location, audits and tracks it", async () => {
    vi.mocked(requireDashboardsAccess).mockResolvedValue({ ...granted, workspaceId: "clws_resolved" });
    vi.mocked(createDashboardRow).mockResolvedValue(dashboardRow({ id: COPY_ID, widgets: [] }));
    const log = auditLog();

    const response = await create(session, log);

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/v3/dashboards/${COPY_ID}`);
    expect(createDashboardRow).toHaveBeenCalledWith({
      workspaceId: "clws_resolved",
      name: "Board",
      createdBy: USER_ID,
    });
    const { data } = await response.json();
    expect(data).toMatchObject({ id: COPY_ID, name: "Board", widgets: [] });
    expect(log).toMatchObject({
      targetId: COPY_ID,
      organizationId: ORGANIZATION_ID,
      newObject: expect.objectContaining({ id: COPY_ID, name: "Board" }),
    });
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "dashboard_created",
      { dashboard_id: COPY_ID },
      { organizationId: ORGANIZATION_ID, workspaceId: "clws_resolved" }
    );
  });

  test("an API key creates without a creator and without a product event", async () => {
    vi.mocked(createDashboardRow).mockResolvedValue(dashboardRow({ creator: null, widgets: [] }));

    const response = await create(apiKey);

    expect(response.status).toBe(201);
    expect(vi.mocked(createDashboardRow).mock.calls[0][0].createdBy).toBeNull();
    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });

  test("answers 409 for a name the workspace already has, and audits nothing", async () => {
    vi.mocked(createDashboardRow).mockRejectedValue(uniqueViolation());
    const log = auditLog();

    const response = await create(session, log);

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("conflict");
    expect(log).toEqual({});
  });

  test("maps any other write failure to 500", async () => {
    vi.mocked(createDashboardRow).mockRejectedValue(recordNotFound());

    expect((await create()).status).toBe(500);
  });
});

describe("renameV3Dashboard", () => {
  const rename = (log?: TV3AuditLog) =>
    renameV3Dashboard({
      dashboardId: DASHBOARD_ID,
      body: { name: "Renamed" },
      auditLog: log,
      ...contextOf(),
    });

  beforeEach(() => {
    vi.mocked(getDashboardResourceRow).mockResolvedValue(dashboardRow());
  });

  test("answers 403 for a missing dashboard and for a caller without write access", async () => {
    vi.mocked(getDashboardResourceRow).mockResolvedValueOnce(null);
    expect((await rename()).status).toBe(403);

    vi.mocked(requireDashboardsAccess).mockResolvedValueOnce(refused());
    expect((await rename()).status).toBe(403);
    expect(requireDashboardsAccess).toHaveBeenCalledWith(
      session,
      WORKSPACE_ID,
      "readWrite",
      REQUEST_ID,
      INSTANCE
    );

    expect(renameDashboardRow).not.toHaveBeenCalled();
  });

  test("renames and audits the old and new name", async () => {
    vi.mocked(renameDashboardRow).mockResolvedValue(dashboardRow({ name: "Renamed" }));
    const log = auditLog();

    const response = await rename(log);

    expect(response.status).toBe(200);
    expect(renameDashboardRow).toHaveBeenCalledWith(DASHBOARD_ID, "Renamed");
    expect((await response.json()).data.name).toBe("Renamed");
    expect(log).toEqual({
      targetId: DASHBOARD_ID,
      organizationId: ORGANIZATION_ID,
      oldObject: { id: DASHBOARD_ID, name: "Board" },
      newObject: { id: DASHBOARD_ID, name: "Renamed" },
    });
  });

  test("answers 409 for a taken name", async () => {
    vi.mocked(renameDashboardRow).mockRejectedValue(uniqueViolation());

    const response = await rename();

    expect(response.status).toBe(409);
    expect((await response.json()).detail).toBe(
      "A dashboard with this name already exists in this workspace."
    );
  });

  test("answers 403 when the dashboard was deleted between the read and the write", async () => {
    vi.mocked(renameDashboardRow).mockRejectedValue(recordNotFound());

    const response = await rename();

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("forbidden");
  });

  test("maps any other failure to 500", async () => {
    vi.mocked(renameDashboardRow).mockRejectedValue(new Error("boom"));

    expect((await rename()).status).toBe(500);
  });
});

describe("duplicateV3Dashboard", () => {
  const duplicate = (name?: string, log?: TV3AuditLog) =>
    duplicateV3Dashboard({
      dashboardId: DASHBOARD_ID,
      body: name === undefined ? {} : { name },
      auditLog: log,
      ...contextOf(),
    });

  beforeEach(() => {
    vi.mocked(getDashboardResourceRow).mockResolvedValue(dashboardRow());
  });

  test("needs write access on the source's workspace", async () => {
    vi.mocked(requireDashboardsAccess).mockResolvedValue(refused());

    expect((await duplicate()).status).toBe(403);
    expect(vi.mocked(requireDashboardsAccess).mock.calls[0][2]).toBe("readWrite");
    expect(duplicateDashboardRow).not.toHaveBeenCalled();
  });

  test("answers 201 with Location and audits the source it was copied from", async () => {
    vi.mocked(duplicateDashboardRow).mockResolvedValue(dashboardRow({ id: COPY_ID, name: "Board (copy)" }));
    const log = auditLog();

    const response = await duplicate(undefined, log);

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/v3/dashboards/${COPY_ID}`);
    expect(duplicateDashboardRow).toHaveBeenCalledWith({
      sourceId: DASHBOARD_ID,
      name: undefined,
      createdBy: USER_ID,
    });
    expect((await response.json()).data).toMatchObject({ id: COPY_ID, name: "Board (copy)" });
    expect(log).toMatchObject({
      targetId: COPY_ID,
      organizationId: ORGANIZATION_ID,
      newObject: expect.objectContaining({ id: COPY_ID, duplicatedFrom: DASHBOARD_ID }),
    });
  });

  test("retries a generated name a concurrent copy took first", async () => {
    vi.mocked(duplicateDashboardRow)
      .mockRejectedValueOnce(uniqueViolation())
      .mockResolvedValueOnce(dashboardRow({ id: COPY_ID, name: "Board (copy 2)" }));

    const response = await duplicate();

    expect(response.status).toBe(201);
    expect(duplicateDashboardRow).toHaveBeenCalledTimes(2);
  });

  test("gives up on a generated name with 409 after three clashes", async () => {
    vi.mocked(duplicateDashboardRow).mockRejectedValue(uniqueViolation());

    const response = await duplicate();

    expect(response.status).toBe(409);
    expect(duplicateDashboardRow).toHaveBeenCalledTimes(3);
  });

  test("answers 409 at once for a name the caller chose", async () => {
    vi.mocked(duplicateDashboardRow).mockRejectedValue(uniqueViolation());

    const response = await duplicate("Board 2");

    expect(response.status).toBe(409);
    expect(duplicateDashboardRow).toHaveBeenCalledTimes(1);
    expect(vi.mocked(duplicateDashboardRow).mock.calls[0][0].name).toBe("Board 2");
  });

  test("answers 403 when the source was deleted before the copy was written", async () => {
    vi.mocked(duplicateDashboardRow).mockResolvedValue(null);
    const log = auditLog();

    const response = await duplicate(undefined, log);

    expect(response.status).toBe(403);
    expect(log).toEqual({});
  });

  test("does not retry any other failure, and maps it to 500", async () => {
    vi.mocked(duplicateDashboardRow).mockRejectedValue(new Error("boom"));

    expect((await duplicate()).status).toBe(500);
    expect(duplicateDashboardRow).toHaveBeenCalledTimes(1);
  });
});

describe("deleteV3Dashboard", () => {
  const remove = (log?: TV3AuditLog) =>
    deleteV3Dashboard({ dashboardId: DASHBOARD_ID, auditLog: log, ...contextOf() });

  beforeEach(() => {
    vi.mocked(getDashboardResourceRow).mockResolvedValue(dashboardRow());
  });

  test("needs write access and deletes nothing without it", async () => {
    vi.mocked(requireDashboardsAccess).mockResolvedValue(refused());

    expect((await remove()).status).toBe(403);
    expect(vi.mocked(requireDashboardsAccess).mock.calls[0][2]).toBe("readWrite");
    expect(deleteDashboardRow).not.toHaveBeenCalled();
  });

  test("answers 204 and audits the dashboard as it was", async () => {
    vi.mocked(deleteDashboardRow).mockResolvedValue({ id: DASHBOARD_ID });
    const log = auditLog();

    const response = await remove(log);

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(deleteDashboardRow).toHaveBeenCalledWith(DASHBOARD_ID);
    expect(log).toMatchObject({
      targetId: DASHBOARD_ID,
      organizationId: ORGANIZATION_ID,
      oldObject: expect.objectContaining({
        name: "Board",
        widgets: [expect.objectContaining({ id: WIDGET_A })],
      }),
    });
  });

  test("answers 403 when a concurrent delete got there first", async () => {
    vi.mocked(deleteDashboardRow).mockRejectedValue(recordNotFound());
    const log = auditLog();

    const response = await remove(log);

    expect(response.status).toBe(403);
    expect(log).toEqual({});
  });

  test("maps any other failure to 500", async () => {
    vi.mocked(deleteDashboardRow).mockRejectedValue(new Error("boom"));

    expect((await remove()).status).toBe(500);
  });
});

describe("replaceV3Dashboard (PUT)", () => {
  const EXPECTED_UPDATED_AT = "2026-02-02T00:00:00.000Z";
  const widgets = [
    { widgetId: WIDGET_A, layout: { x: 0, y: 0, w: 6, h: 4 }, order: 0 },
    { widgetId: WIDGET_B, layout: { x: 6, y: 0, w: 6, h: 4 }, order: 1 },
  ];
  const replace = (log?: TV3AuditLog) =>
    replaceV3Dashboard({
      dashboardId: DASHBOARD_ID,
      body: { name: "Saved", updatedAt: EXPECTED_UPDATED_AT, widgets },
      auditLog: log,
      ...contextOf(),
    });
  const resultIs = (result: TDashboardReplaceResult) =>
    vi.mocked(replaceDashboardRow).mockResolvedValue(result);

  beforeEach(() => {
    vi.mocked(getDashboardWorkspaceRow).mockResolvedValue({ id: DASHBOARD_ID, workspaceId: WORKSPACE_ID });
  });

  test("answers 403 for a missing dashboard and for a caller without write access, writing nothing", async () => {
    vi.mocked(getDashboardWorkspaceRow).mockResolvedValueOnce(null);
    expect((await replace()).status).toBe(403);

    vi.mocked(requireDashboardsAccess).mockResolvedValueOnce(refused());
    expect((await replace()).status).toBe(403);
    expect(vi.mocked(requireDashboardsAccess).mock.calls[0][1]).toBe(WORKSPACE_ID);
    expect(vi.mocked(requireDashboardsAccess).mock.calls[0][2]).toBe("readWrite");

    expect(replaceDashboardRow).not.toHaveBeenCalled();
  });

  test("writes the name and every widget against the caller's updatedAt, and audits before and after", async () => {
    const previous = {
      name: "Board",
      widgets: [{ id: WIDGET_A, layout: { x: 0, y: 0, w: 4, h: 4 }, order: 0 }],
    };
    resultIs({ kind: "ok", row: dashboardRow({ name: "Saved" }), previous });
    const log = auditLog();

    const response = await replace(log);

    expect(response.status).toBe(200);
    expect(replaceDashboardRow).toHaveBeenCalledWith({
      dashboardId: DASHBOARD_ID,
      expectedUpdatedAt: new Date(EXPECTED_UPDATED_AT),
      name: "Saved",
      widgets,
    });
    expect((await response.json()).data).toMatchObject({ id: DASHBOARD_ID, name: "Saved" });
    expect(log).toEqual({
      targetId: DASHBOARD_ID,
      organizationId: ORGANIZATION_ID,
      oldObject: previous,
      newObject: { name: "Saved", widgets: [{ id: WIDGET_A, layout: { x: 0, y: 0, w: 6, h: 4 }, order: 0 }] },
    });
  });

  test("answers 409 with both timestamps when the dashboard changed since the caller's read", async () => {
    resultIs({ kind: "stale", currentUpdatedAt: new Date("2026-02-03T10:00:00.000Z") });
    const log = auditLog();

    const response = await replace(log);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe("conflict");
    expect(body.details).toEqual({
      expectedUpdatedAt: EXPECTED_UPDATED_AT,
      currentUpdatedAt: "2026-02-03T10:00:00.000Z",
    });
    expect(log).toEqual({});
  });

  test("answers 403 when the dashboard was deleted under the write", async () => {
    resultIs({ kind: "gone" });

    const response = await replace();

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("forbidden");
  });

  test.each([
    {
      result: {
        kind: "unknownWidgets",
        widgetIds: [WIDGET_B, "clwi_other"],
      } satisfies TDashboardReplaceResult as TDashboardReplaceResult,
      detail: "The widgets do not match the dashboard",
      reason: `Not on this dashboard: ${WIDGET_B}, clwi_other.`,
    },
    {
      result: {
        kind: "missingWidgets",
        widgetIds: [WIDGET_B],
      } satisfies TDashboardReplaceResult as TDashboardReplaceResult,
      detail: "The widgets do not match the dashboard",
      reason: expect.stringContaining(`missing: ${WIDGET_B}.`),
    },
    {
      result: {
        kind: "overlap",
        widgetIds: [WIDGET_A, WIDGET_B],
      } satisfies TDashboardReplaceResult as TDashboardReplaceResult,
      detail: "Two widgets overlap",
      reason: `Widgets ${WIDGET_A} and ${WIDGET_B} overlap. Widgets may leave gaps but not overlap.`,
    },
  ])("answers 422 on widgets for $result.kind", async ({ result, detail, reason }) => {
    resultIs(result);

    const response = await replace();

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body).toMatchObject({ code: "unprocessable_content", detail });
    expect(body.invalid_params).toEqual([{ name: "widgets", reason }]);
  });

  test("answers 409 for a name another dashboard has", async () => {
    vi.mocked(replaceDashboardRow).mockRejectedValue(uniqueViolation());

    const response = await replace();

    expect(response.status).toBe(409);
    expect((await response.json()).detail).toBe(
      "A dashboard with this name already exists in this workspace."
    );
  });

  test("maps any other failure to 500", async () => {
    vi.mocked(replaceDashboardRow).mockRejectedValue(new Error("boom"));

    expect((await replace()).status).toBe(500);
  });
});

describe("updateV3DashboardLayout (MCP update_dashboard_layout)", () => {
  const EXPECTED_UPDATED_AT = "2026-02-02T00:00:00.000Z";
  const widgets = [{ widgetId: WIDGET_A, layout: { x: 0, y: 0, w: 12, h: 4 } }];
  const rearrange = (log?: TV3AuditLog) =>
    updateV3DashboardLayout({
      dashboardId: DASHBOARD_ID,
      body: { updatedAt: EXPECTED_UPDATED_AT, widgets },
      auditLog: log,
      ...contextOf(),
    });

  beforeEach(() => {
    vi.mocked(getDashboardWorkspaceRow).mockResolvedValue({ id: DASHBOARD_ID, workspaceId: WORKSPACE_ID });
  });

  test("keeps the name and requires every current widget", async () => {
    vi.mocked(replaceDashboardRow).mockResolvedValue({
      kind: "ok",
      row: dashboardRow(),
      previous: { name: "Board", widgets: [] },
    });
    const log = auditLog();

    const response = await rearrange(log);

    expect(response.status).toBe(200);
    expect(replaceDashboardRow).toHaveBeenCalledWith({
      dashboardId: DASHBOARD_ID,
      expectedUpdatedAt: new Date(EXPECTED_UPDATED_AT),
      widgets,
      requireEveryWidget: true,
    });
    expect(vi.mocked(replaceDashboardRow).mock.calls[0][0]).not.toHaveProperty("name");
    expect(log).toMatchObject({ targetId: DASHBOARD_ID, organizationId: ORGANIZATION_ID });
  });

  test("refuses to drop a widget it was not told about with 422", async () => {
    vi.mocked(replaceDashboardRow).mockResolvedValue({ kind: "missingWidgets", widgetIds: [WIDGET_B] });

    const response = await rearrange();

    expect(response.status).toBe(422);
    expect((await response.json()).invalid_params[0]).toMatchObject({ name: "widgets" });
  });

  test("returns the access refusal without writing", async () => {
    vi.mocked(requireDashboardsAccess).mockResolvedValue(refused());

    expect((await rearrange()).status).toBe(403);
    expect(replaceDashboardRow).not.toHaveBeenCalled();
  });

  test("maps an unexpected failure to 500", async () => {
    vi.mocked(getDashboardWorkspaceRow).mockRejectedValue(new Error("boom"));

    expect((await rearrange()).status).toBe(500);
  });
});
