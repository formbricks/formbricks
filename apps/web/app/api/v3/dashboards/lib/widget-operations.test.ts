import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { requireDashboardsAccess } from "@/app/api/v3/lib/dashboards-access";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { getDashboardWorkspaceRow } from "./service";
import { addV3DashboardWidget, removeV3DashboardWidget, updateV3DashboardWidget } from "./widget-operations";
import {
  type TWidgetWriteResult,
  addWidgetRow,
  deleteWidgetRow,
  getChartTypeInWorkspace,
  updateWidgetRow,
} from "./widget-service";

/**
 * The widget operations' HTTP answers: how each widget-write outcome becomes a status and problem, which
 * workspace the chart is checked against, and what the audit log records. The transaction logic is in
 * widget-service.test.ts; the real-database behaviour in widget-operations.integration.test.ts.
 */

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

vi.mock("@/app/api/v3/lib/dashboards-access", () => ({ requireDashboardsAccess: vi.fn() }));
vi.mock("./service", () => ({ getDashboardWorkspaceRow: vi.fn() }));
vi.mock("./widget-service", () => ({
  addWidgetRow: vi.fn(),
  updateWidgetRow: vi.fn(),
  deleteWidgetRow: vi.fn(),
  getChartTypeInWorkspace: vi.fn(),
}));

const DASHBOARD_ID = "cldb000000000000000000001";
const WIDGET_ID = "clwg000000000000000000001";
const CHART_ID = "clch000000000000000000001";
const WORKSPACE_ID = "clws000000000000000000001";
const ORGANIZATION_ID = "clor000000000000000000001";

const context = {
  authentication: { user: { id: "user_1" } } as never,
  requestId: "req_1",
  instance: "/api/v3/dashboards/widgets",
};

const layout = { x: 4, y: 0, w: 4, h: 4 };

const widgetRow = (overrides: { chartId?: string; layout?: unknown } = {}) => ({
  id: WIDGET_ID,
  chartId: overrides.chartId ?? CHART_ID,
  layout: overrides.layout ?? layout,
  order: 2,
  chart: {
    id: overrides.chartId ?? CHART_ID,
    workspaceId: WORKSPACE_ID,
    feedbackDirectoryId: "clds000000000000000000001",
    name: "Bar",
    type: "bar",
    query: { measures: ["FeedbackRecords.count"] },
    config: {},
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    creator: { name: "editor" },
    widgets: [{ dashboard: { id: DASHBOARD_ID, name: "Board" } }],
  },
});

const ok = (previous?: { chartId: string; layout: unknown }, row = widgetRow()): TWidgetWriteResult =>
  ({ kind: "ok", widget: row, ...(previous ? { previous } : {}) }) as TWidgetWriteResult;

const problemOf = async (response: Response) =>
  (await response.json()) as { code?: string; invalid_params?: { name: string; reason: string }[] };

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("write failed", { code, clientVersion: "7" });

const freshAuditLog = () => ({}) as TV3AuditLog;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDashboardWorkspaceRow).mockResolvedValue({ id: DASHBOARD_ID, workspaceId: WORKSPACE_ID });
  vi.mocked(requireDashboardsAccess).mockResolvedValue({
    workspaceId: WORKSPACE_ID,
    organizationId: ORGANIZATION_ID,
  });
  vi.mocked(getChartTypeInWorkspace).mockResolvedValue("bar");
});

/** The refusals every write shares: a missing dashboard and a caller without write access. */
describe.each([
  {
    name: "add",
    run: () => addV3DashboardWidget({ dashboardId: DASHBOARD_ID, body: { chartId: CHART_ID }, ...context }),
    write: addWidgetRow,
  },
  {
    name: "update",
    run: () =>
      updateV3DashboardWidget({
        dashboardId: DASHBOARD_ID,
        widgetId: WIDGET_ID,
        body: { layout },
        ...context,
      }),
    write: updateWidgetRow,
  },
  {
    name: "remove",
    run: () => removeV3DashboardWidget({ dashboardId: DASHBOARD_ID, widgetId: WIDGET_ID, ...context }),
    write: deleteWidgetRow,
  },
])("$name: authorization", ({ run, write }) => {
  test("answers 403 for a dashboard that does not exist, without checking access or writing", async () => {
    vi.mocked(getDashboardWorkspaceRow).mockResolvedValueOnce(null);
    const response = await run();
    expect(response.status).toBe(403);
    expect((await problemOf(response)).code).toBe("forbidden");
    expect(requireDashboardsAccess).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  test("asks for write access to the dashboard's own workspace, and passes a refusal through", async () => {
    const refusal = problemForbidden("req_1");
    vi.mocked(requireDashboardsAccess).mockResolvedValueOnce(refusal);
    expect(await run()).toBe(refusal);
    expect(requireDashboardsAccess).toHaveBeenCalledWith(
      context.authentication,
      WORKSPACE_ID,
      "readWrite",
      context.requestId,
      context.instance
    );
    expect(write).not.toHaveBeenCalled();
  });

  test("answers 500 without leaking the error when the write throws something unexpected", async () => {
    vi.mocked(write).mockRejectedValueOnce(new Error("connection reset by peer at 10.0.0.1"));
    const response = await run();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("10.0.0.1");
  });
});

describe("addV3DashboardWidget", () => {
  const add = (
    auditLog?: TV3AuditLog,
    body: { chartId: string; layout?: typeof layout } = { chartId: CHART_ID }
  ) => addV3DashboardWidget({ dashboardId: DASHBOARD_ID, body, auditLog, ...context });

  test("answers 201 with the widget and its Location, and fills the audit log", async () => {
    vi.mocked(addWidgetRow).mockResolvedValueOnce(ok());
    const auditLog = freshAuditLog();

    const response = await add(auditLog, { chartId: CHART_ID, layout });

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/v3/dashboards/${DASHBOARD_ID}/widgets/${WIDGET_ID}`);
    const { data } = (await response.json()) as { data: Record<string, unknown> };
    expect(data).toMatchObject({
      id: WIDGET_ID,
      chartId: CHART_ID,
      layout,
      order: 2,
      chart: { id: CHART_ID },
    });
    expect(auditLog).toEqual({
      targetId: WIDGET_ID,
      organizationId: ORGANIZATION_ID,
      newObject: { dashboardId: DASHBOARD_ID, chartId: CHART_ID, layout },
    });
  });

  test("checks the chart against the dashboard's workspace and places it by the chart's type", async () => {
    vi.mocked(getChartTypeInWorkspace).mockResolvedValueOnce("big_number");
    vi.mocked(addWidgetRow).mockResolvedValueOnce(ok());

    await add(undefined, { chartId: CHART_ID, layout });

    expect(getChartTypeInWorkspace).toHaveBeenCalledWith(CHART_ID, WORKSPACE_ID);
    expect(addWidgetRow).toHaveBeenCalledWith({
      dashboardId: DASHBOARD_ID,
      chartId: CHART_ID,
      chartType: "big_number",
      layout,
    });
  });

  test("answers 403 for a chart outside the dashboard's workspace, and writes nothing", async () => {
    vi.mocked(getChartTypeInWorkspace).mockResolvedValueOnce(null);
    const auditLog = freshAuditLog();
    const response = await add(auditLog);
    expect(response.status).toBe(403);
    expect(addWidgetRow).not.toHaveBeenCalled();
    expect(auditLog).toEqual({});
  });

  test("answers 409 for a chart already on the dashboard", async () => {
    vi.mocked(addWidgetRow).mockResolvedValueOnce({ kind: "duplicate" });
    const auditLog = freshAuditLog();
    const response = await add(auditLog);
    expect(response.status).toBe(409);
    expect((await problemOf(response)).code).toBe("conflict");
    expect(auditLog).toEqual({});
  });

  test("answers 422 naming the widget a layout overlaps", async () => {
    vi.mocked(addWidgetRow).mockResolvedValueOnce({ kind: "overlap", widgetId: "clwg_blocking" });
    const response = await add();
    expect(response.status).toBe(422);
    expect((await problemOf(response)).invalid_params).toEqual([
      { name: "layout", reason: expect.stringContaining("clwg_blocking") },
    ]);
  });

  test("answers 403 when the dashboard was deleted before the write", async () => {
    vi.mocked(addWidgetRow).mockResolvedValueOnce({ kind: "gone" });
    expect((await add()).status).toBe(403);
  });

  test("answers a concurrent add of the same chart (unique violation) as 409", async () => {
    vi.mocked(addWidgetRow).mockRejectedValueOnce(prismaError("P2002"));
    const response = await add();
    expect(response.status).toBe(409);
    expect((await problemOf(response)).code).toBe("conflict");
  });

  test("answers a chart deleted between its check and the write (foreign key) as 403", async () => {
    vi.mocked(addWidgetRow).mockRejectedValueOnce(prismaError("P2003"));
    expect((await add()).status).toBe(403);
  });
});

describe("updateV3DashboardWidget", () => {
  const update = (body: { layout?: typeof layout; chartId?: string }, auditLog?: TV3AuditLog) =>
    updateV3DashboardWidget({ dashboardId: DASHBOARD_ID, widgetId: WIDGET_ID, body, auditLog, ...context });

  test("answers 200 with the widget and records before and after for undo", async () => {
    const previous = { chartId: "clch_old", layout: { x: 0, y: 0, w: 4, h: 4 } };
    vi.mocked(updateWidgetRow).mockResolvedValueOnce(ok(previous));
    const auditLog = freshAuditLog();

    const response = await update({ chartId: CHART_ID, layout }, auditLog);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Record<string, unknown> };
    expect(data).toMatchObject({ id: WIDGET_ID, chartId: CHART_ID, layout });
    expect(updateWidgetRow).toHaveBeenCalledWith({
      dashboardId: DASHBOARD_ID,
      widgetId: WIDGET_ID,
      layout,
      chartId: CHART_ID,
    });
    expect(auditLog).toEqual({
      targetId: WIDGET_ID,
      organizationId: ORGANIZATION_ID,
      oldObject: { dashboardId: DASHBOARD_ID, ...previous },
      newObject: { dashboardId: DASHBOARD_ID, chartId: CHART_ID, layout },
    });
  });

  test("checks a repoint target against the dashboard's workspace, and refuses one outside it with 403", async () => {
    vi.mocked(getChartTypeInWorkspace).mockResolvedValueOnce(null);
    const response = await update({ chartId: "clch_foreign" });
    expect(response.status).toBe(403);
    expect(getChartTypeInWorkspace).toHaveBeenCalledWith("clch_foreign", WORKSPACE_ID);
    expect(updateWidgetRow).not.toHaveBeenCalled();
  });

  test("does not look up a chart for a move alone", async () => {
    vi.mocked(updateWidgetRow).mockResolvedValueOnce(ok({ chartId: CHART_ID, layout }));
    expect((await update({ layout })).status).toBe(200);
    expect(getChartTypeInWorkspace).not.toHaveBeenCalled();
  });

  test.each([
    { result: { kind: "duplicate" } as const, status: 409, code: "conflict" },
    {
      result: { kind: "overlap", widgetId: "clwg_other" } as const,
      status: 422,
      code: "unprocessable_content",
    },
    { result: { kind: "gone" } as const, status: 403, code: "forbidden" },
  ])(
    "answers a $result.kind write as $status and leaves the audit log empty",
    async ({ result, status, code }) => {
      vi.mocked(updateWidgetRow).mockResolvedValueOnce(result);
      const auditLog = freshAuditLog();
      const response = await update({ layout }, auditLog);
      expect(response.status).toBe(status);
      expect((await problemOf(response)).code).toBe(code);
      expect(auditLog).toEqual({});
    }
  );

  test("answers a repoint racing another widget onto the same chart (unique violation) as 409", async () => {
    vi.mocked(updateWidgetRow).mockRejectedValueOnce(prismaError("P2002"));
    expect((await update({ chartId: CHART_ID })).status).toBe(409);
  });
});

describe("removeV3DashboardWidget", () => {
  const remove = (auditLog?: TV3AuditLog) =>
    removeV3DashboardWidget({ dashboardId: DASHBOARD_ID, widgetId: WIDGET_ID, auditLog, ...context });

  test("answers 204, removing the widget from this dashboard, and records what was removed", async () => {
    const removed = { chartId: CHART_ID, layout };
    vi.mocked(deleteWidgetRow).mockResolvedValueOnce(removed);
    const auditLog = freshAuditLog();

    const response = await remove(auditLog);

    expect(response.status).toBe(204);
    expect(deleteWidgetRow).toHaveBeenCalledWith(DASHBOARD_ID, WIDGET_ID);
    expect(auditLog).toEqual({
      targetId: WIDGET_ID,
      organizationId: ORGANIZATION_ID,
      oldObject: { dashboardId: DASHBOARD_ID, ...removed },
    });
  });

  test("answers 403 for a widget that is not on the dashboard", async () => {
    vi.mocked(deleteWidgetRow).mockResolvedValueOnce(null);
    const auditLog = freshAuditLog();
    expect((await remove(auditLog)).status).toBe(403);
    expect(auditLog).toEqual({});
  });
});
