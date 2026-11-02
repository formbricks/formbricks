import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  createDashboardRow,
  deleteDashboardRow,
  duplicateDashboardRow,
  getDashboardResourceRow,
  getDashboardWorkspaceRow,
  listDashboardRows,
  renameDashboardRow,
} from "./service";

vi.mock("server-only", () => ({}));

const { tx } = vi.hoisted(() => ({
  tx: {
    $queryRaw: vi.fn(),
    dashboard: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    dashboard: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  },
}));

const WORKSPACE_ID = "clws000000000000000000001";
const DASHBOARD_ID = "clda000000000000000000001";
const CHART_ID = "clch000000000000000000001";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getDashboardResourceRow", () => {
  test("reads one dashboard by id with its widgets in display order, each with its chart", async () => {
    vi.mocked(prisma.dashboard.findUnique).mockResolvedValue(null);

    expect(await getDashboardResourceRow(DASHBOARD_ID)).toBeNull();

    const args = vi.mocked(prisma.dashboard.findUnique).mock.calls[0][0];
    expect(args.where).toEqual({ id: DASHBOARD_ID });
    expect(args.select).toMatchObject({
      workspaceId: true,
      widgets: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: { chart: { select: expect.objectContaining({ id: true, workspaceId: true }) } },
      },
    });
  });
});

describe("getDashboardWorkspaceRow", () => {
  test("reads only the id and the workspace to authorize against", async () => {
    vi.mocked(prisma.dashboard.findUnique).mockResolvedValue({
      id: DASHBOARD_ID,
      workspaceId: WORKSPACE_ID,
    } as never);

    expect(await getDashboardWorkspaceRow(DASHBOARD_ID)).toEqual({
      id: DASHBOARD_ID,
      workspaceId: WORKSPACE_ID,
    });
    expect(prisma.dashboard.findUnique).toHaveBeenCalledWith({
      where: { id: DASHBOARD_ID },
      select: { id: true, workspaceId: true },
    });
  });
});

describe("listDashboardRows", () => {
  const whereOf = () => vi.mocked(prisma.dashboard.findMany).mock.calls[0][0]!.where;

  beforeEach(() => {
    vi.mocked(prisma.dashboard.findMany).mockResolvedValue([]);
  });

  test("scopes to the workspace, newest first, one row past the limit, with widget counts", async () => {
    await listDashboardRows({ filter: { workspaceId: WORKSPACE_ID }, cursor: null, limit: 20 });

    const args = vi.mocked(prisma.dashboard.findMany).mock.calls[0][0]!;
    expect(args.where).toEqual({ workspaceId: WORKSPACE_ID });
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(args.take).toBe(21);
    expect(args.select).toMatchObject({ _count: { select: { widgets: true } } });
    expect(args.select).not.toHaveProperty("widgets");
  });

  test("matches the name case-insensitively with LIKE wildcards escaped", async () => {
    await listDashboardRows({
      filter: { workspaceId: WORKSPACE_ID, nameContains: "50%_off" },
      cursor: null,
      limit: 20,
    });

    expect(whereOf()).toEqual({
      workspaceId: WORKSPACE_ID,
      name: { contains: String.raw`50\%\_off`, mode: "insensitive" },
    });
  });

  test("narrows to the dashboards holding a chart", async () => {
    await listDashboardRows({
      filter: { workspaceId: WORKSPACE_ID, chartId: CHART_ID },
      cursor: null,
      limit: 20,
    });

    expect(whereOf()).toEqual({ workspaceId: WORKSPACE_ID, widgets: { some: { chartId: CHART_ID } } });
  });

  test("resumes strictly after the cursor's row, ties broken by id", async () => {
    await listDashboardRows({
      filter: { workspaceId: WORKSPACE_ID },
      cursor: { value: "2026-03-02T00:00:00.000Z", id: DASHBOARD_ID },
      limit: 20,
    });

    const after = new Date("2026-03-02T00:00:00.000Z");
    expect(whereOf()).toEqual({
      workspaceId: WORKSPACE_ID,
      OR: [{ createdAt: { lt: after } }, { createdAt: after, id: { lt: DASHBOARD_ID } }],
    });
  });
});

describe("createDashboardRow", () => {
  test("creates with exactly the given workspace, name and creator", async () => {
    await createDashboardRow({ workspaceId: WORKSPACE_ID, name: "Board", createdBy: null });

    const args = vi.mocked(prisma.dashboard.create).mock.calls[0][0];
    expect(args.data).toEqual({ workspaceId: WORKSPACE_ID, name: "Board", createdBy: null });
    expect(args.select).toHaveProperty("widgets");
  });
});

describe("renameDashboardRow", () => {
  const NOW = new Date("2026-05-01T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("locks the row, then renames and moves updatedAt to now", async () => {
    tx.$queryRaw.mockResolvedValue([{ updatedAt: new Date("2026-04-01T00:00:00.000Z") }]);
    tx.dashboard.update.mockResolvedValue({ id: DASHBOARD_ID });

    await renameDashboardRow(DASHBOARD_ID, "Renamed");

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.dashboard.update.mock.invocationCallOrder[0]
    );
    const args = tx.dashboard.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: DASHBOARD_ID });
    expect(args.data).toEqual({ name: "Renamed", updatedAt: NOW });
  });

  test("moves updatedAt past the stored one even when the clock lags it", async () => {
    tx.$queryRaw.mockResolvedValue([{ updatedAt: NOW }]);

    await renameDashboardRow(DASHBOARD_ID, "Renamed");

    expect(tx.dashboard.update.mock.calls[0][0].data.updatedAt).toEqual(new Date(NOW.getTime() + 1));
  });

  test("leaves a deleted dashboard to the update, which throws Prisma's not-found error", async () => {
    tx.$queryRaw.mockResolvedValue([]);
    const notFound = new Error("Record to update not found");
    tx.dashboard.update.mockRejectedValue(notFound);

    await expect(renameDashboardRow(DASHBOARD_ID, "Renamed")).rejects.toBe(notFound);
    expect(tx.dashboard.update.mock.calls[0][0].data).toEqual({ name: "Renamed" });
  });
});

describe("deleteDashboardRow", () => {
  test("deletes by id", async () => {
    await deleteDashboardRow(DASHBOARD_ID);

    expect(prisma.dashboard.delete).toHaveBeenCalledWith({
      where: { id: DASHBOARD_ID },
      select: { id: true },
    });
  });
});

describe("duplicateDashboardRow", () => {
  const source = {
    name: "Board",
    workspaceId: WORKSPACE_ID,
    widgets: [
      { chartId: CHART_ID, layout: { x: 0, y: 0, w: 6, h: 4 }, order: 0 },
      { chartId: "clch000000000000000000002", layout: null, order: 1 },
    ],
  };

  test("returns null and writes nothing when the source is gone", async () => {
    tx.dashboard.findUnique.mockResolvedValue(null);

    expect(await duplicateDashboardRow({ sourceId: DASHBOARD_ID, createdBy: null })).toBeNull();
    expect(tx.dashboard.create).not.toHaveBeenCalled();
  });

  test("copies into the source's workspace, pointing at the same charts in the same layout", async () => {
    tx.dashboard.findUnique.mockResolvedValue(source);

    await duplicateDashboardRow({ sourceId: DASHBOARD_ID, name: "Board for sales", createdBy: "user_1" });

    expect(tx.dashboard.findUnique.mock.calls[0][0].where).toEqual({ id: DASHBOARD_ID });
    expect(tx.dashboard.findMany).not.toHaveBeenCalled();
    expect(tx.dashboard.create.mock.calls[0][0].data).toEqual({
      name: "Board for sales",
      workspaceId: WORKSPACE_ID,
      createdBy: "user_1",
      widgets: {
        create: [
          { chartId: CHART_ID, layout: { x: 0, y: 0, w: 6, h: 4 }, order: 0 },
          { chartId: "clch000000000000000000002", layout: {}, order: 1 },
        ],
      },
    });
  });

  test("reads the source's widgets in display order and numbers the copy's plainly, so tied orders keep it", async () => {
    tx.dashboard.findUnique.mockResolvedValue({
      ...source,
      widgets: [
        { chartId: CHART_ID, layout: { x: 0, y: 0, w: 6, h: 4 } },
        { chartId: "clch000000000000000000002", layout: { x: 6, y: 0, w: 6, h: 4 } },
      ],
    });

    await duplicateDashboardRow({ sourceId: DASHBOARD_ID, createdBy: null, name: "Copy" });

    expect(tx.dashboard.findUnique.mock.calls[0][0].select.widgets.orderBy).toEqual([
      { order: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ]);
    expect(
      tx.dashboard.create.mock.calls[0][0].data.widgets.create.map(
        (widget: { chartId: string; order: number }) => [widget.chartId, widget.order]
      )
    ).toEqual([
      [CHART_ID, 0],
      ["clch000000000000000000002", 1],
    ]);
  });

  test("without a name, takes the first free copy name among the workspace's dashboards", async () => {
    tx.dashboard.findUnique.mockResolvedValue({ ...source, name: "Board (copy)" });
    tx.dashboard.findMany.mockResolvedValue([{ name: "Board (copy)" }, { name: "Board (copy 3)" }]);

    await duplicateDashboardRow({ sourceId: DASHBOARD_ID, createdBy: null });

    expect(tx.dashboard.findMany.mock.calls[0][0].where).toEqual({
      workspaceId: WORKSPACE_ID,
      name: { startsWith: "Board (copy" },
    });
    expect(tx.dashboard.create.mock.calls[0][0].data.name).toBe("Board (copy 2)");
  });

  test("escapes the name for the copy-name lookup, so a backslash or wildcard in it matches itself", async () => {
    tx.dashboard.findUnique.mockResolvedValue({ ...source, name: String.raw`Q3 \ Q4 100%_done` });
    tx.dashboard.findMany.mockResolvedValue([]);

    await duplicateDashboardRow({ sourceId: DASHBOARD_ID, createdBy: null });

    expect(tx.dashboard.findMany.mock.calls[0][0].where.name).toEqual({
      startsWith: String.raw`Q3 \\ Q4 100\%\_done (copy`,
    });
  });
});
