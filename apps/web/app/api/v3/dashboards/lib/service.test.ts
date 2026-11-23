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
    dashboard: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    dashboardPage: { create: vi.fn() },
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
const COPY_ID = "clda000000000000000000002";

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
    // Every dashboard starts with one page, "Overview".
    expect(args.data).toEqual({
      workspaceId: WORKSPACE_ID,
      name: "Board",
      createdBy: null,
      pages: { create: { name: "Overview", order: 0 } },
    });
    expect(args.select).toHaveProperty("widgets");
    expect(args.select).toHaveProperty("pages");
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
  const filters = [
    {
      id: "clfi000000000000000000001",
      field: "FeedbackRecords.language",
      operator: "equals",
      label: "Language",
    },
  ];
  const textContent = { headline: "Q3", description: "" };
  const source = {
    name: "Board",
    workspaceId: WORKSPACE_ID,
    filters,
    pages: [
      {
        name: "Overview",
        teamLimits: [],
        widgets: [
          { kind: "chart", chartId: CHART_ID, content: null, layout: { x: 0, y: 0, w: 6, h: 4 } },
          { kind: "chart", chartId: "clch000000000000000000002", content: null, layout: null },
        ],
      },
      {
        name: "Sales",
        teamLimits: [{ teamId: "clte000000000000000000001" }],
        widgets: [
          { kind: "chart", chartId: CHART_ID, content: null, layout: { x: 0, y: 0, w: 4, h: 4 } },
          { kind: "text", chartId: null, content: textContent, layout: { x: 4, y: 0, w: 8, h: 2 } },
        ],
      },
    ],
  };

  beforeEach(() => {
    tx.dashboard.create.mockResolvedValue({ id: COPY_ID });
    tx.dashboard.findUniqueOrThrow.mockResolvedValue({ id: COPY_ID });
  });

  test("returns null and writes nothing when the source is gone", async () => {
    tx.dashboard.findUnique.mockResolvedValue(null);

    expect(await duplicateDashboardRow({ sourceId: DASHBOARD_ID, createdBy: null })).toBeNull();
    expect(tx.dashboard.create).not.toHaveBeenCalled();
  });

  test("copies into the source's workspace with its filters, then each page with its team limit and widgets", async () => {
    tx.dashboard.findUnique.mockResolvedValue(source);

    await duplicateDashboardRow({ sourceId: DASHBOARD_ID, name: "Board for sales", createdBy: "user_1" });

    expect(tx.dashboard.findUnique.mock.calls[0][0].where).toEqual({ id: DASHBOARD_ID });
    expect(tx.dashboard.findMany).not.toHaveBeenCalled();
    expect(tx.dashboard.create.mock.calls[0][0].data).toEqual({
      name: "Board for sales",
      workspaceId: WORKSPACE_ID,
      createdBy: "user_1",
      filters,
    });
    expect(tx.dashboardPage.create.mock.calls.map(([args]) => args.data)).toEqual([
      {
        dashboardId: COPY_ID,
        name: "Overview",
        order: 0,
        teamLimits: { create: [] },
        widgets: {
          create: [
            expect.objectContaining({ dashboardId: COPY_ID, kind: "chart", chartId: CHART_ID, order: 0 }),
            expect.objectContaining({ chartId: "clch000000000000000000002", layout: {}, order: 1 }),
          ],
        },
      },
      {
        dashboardId: COPY_ID,
        name: "Sales",
        order: 1,
        teamLimits: { create: [{ teamId: "clte000000000000000000001" }] },
        widgets: {
          create: [
            expect.objectContaining({ kind: "chart", chartId: CHART_ID, order: 0 }),
            expect.objectContaining({ kind: "text", chartId: null, content: textContent, order: 1 }),
          ],
        },
      },
    ]);
    // A chart may sit on two pages of the source, and so of the copy.
    expect(tx.dashboard.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: COPY_ID } })
    );
  });

  test("reads the source's pages and widgets in display order", async () => {
    tx.dashboard.findUnique.mockResolvedValue(source);

    await duplicateDashboardRow({ sourceId: DASHBOARD_ID, createdBy: null, name: "Copy" });

    const select = tx.dashboard.findUnique.mock.calls[0][0].select;
    const readOrder = [{ order: "asc" }, { createdAt: "asc" }, { id: "asc" }];
    expect(select.pages.orderBy).toEqual(readOrder);
    expect(select.pages.select.widgets.orderBy).toEqual(readOrder);
  });

  test("gives a copy of a dashboard without pages the first page every dashboard has", async () => {
    tx.dashboard.findUnique.mockResolvedValue({ ...source, pages: [] });

    await duplicateDashboardRow({ sourceId: DASHBOARD_ID, createdBy: null, name: "Copy" });

    expect(tx.dashboardPage.create).toHaveBeenCalledTimes(1);
    expect(tx.dashboardPage.create.mock.calls[0][0].data).toMatchObject({ name: "Overview", order: 0 });
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
