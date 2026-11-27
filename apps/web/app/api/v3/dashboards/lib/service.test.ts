import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  READABLE_SCAN_MAX_ROUNDS,
  createDashboardRow,
  deleteDashboardRow,
  duplicateDashboardRow,
  getDashboardResourceRow,
  getDashboardWorkspaceRow,
  listDashboardPageScopeRows,
  listDashboardRows,
  listReadableDashboardRows,
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
    dashboardPage: { createMany: vi.fn() },
    dashboardPageTeam: { createMany: vi.fn() },
    dashboardWidget: { createMany: vi.fn() },
  },
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    dashboard: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
    dashboardPage: { findMany: vi.fn() },
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

describe("listDashboardPageScopeRows", () => {
  test("reads the dashboards' pages with their widget counts, and only a chart filter's widgets", async () => {
    vi.mocked(prisma.dashboardPage.findMany).mockResolvedValue([]);

    await listDashboardPageScopeRows([DASHBOARD_ID], CHART_ID);
    await listDashboardPageScopeRows([DASHBOARD_ID]);

    const [[withChart], [withoutChart]] = vi.mocked(prisma.dashboardPage.findMany).mock.calls;
    expect(withChart!.where).toEqual({ dashboardId: { in: [DASHBOARD_ID] } });
    expect(withChart!.select).toMatchObject({
      _count: { select: { widgets: true } },
      widgets: { where: { chartId: CHART_ID }, take: 1 },
    });
    expect(withoutChart!.select).toMatchObject({ widgets: { where: { id: { in: [] } } } });
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
        teamLimited: false,
        teamLimits: [],
        widgets: [
          { kind: "chart", chartId: CHART_ID, content: null, layout: { x: 0, y: 0, w: 6, h: 4 } },
          { kind: "chart", chartId: "clch000000000000000000002", content: null, layout: null },
        ],
      },
      {
        name: "Sales",
        teamLimited: true,
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

  /** What the copy wrote: each page with its team limit and its widgets, joined on the minted page ids. */
  type TWrittenPage = { id: string; dashboardId: string; name: string; order: number; teamLimited: boolean };
  type TWrittenWidget = { pageId: string; chartId: string | null; order: number } & Record<string, unknown>;
  const writtenPages = () => {
    const dataOf = <T>(fn: { mock: { calls: unknown[][] } }): T[] =>
      fn.mock.calls.flatMap(([args]) => (args as { data: T[] }).data);
    const pages = dataOf<TWrittenPage>(tx.dashboardPage.createMany);
    const teamLimits = dataOf<{ pageId: string; teamId: string }>(tx.dashboardPageTeam.createMany);
    const widgets = dataOf<TWrittenWidget>(tx.dashboardWidget.createMany);
    return pages.map(({ id, ...page }) => ({
      ...page,
      teamIds: teamLimits.filter((limit) => limit.pageId === id).map(({ teamId }) => teamId),
      widgets: widgets
        .filter((widget) => widget.pageId === id)
        .map(({ pageId: _pageId, ...widget }) => widget),
    }));
  };

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
    // One bulk write per table, whatever the number of pages.
    expect(tx.dashboardPage.createMany).toHaveBeenCalledTimes(1);
    expect(tx.dashboardPageTeam.createMany).toHaveBeenCalledTimes(1);
    expect(tx.dashboardWidget.createMany).toHaveBeenCalledTimes(1);
    expect(writtenPages()).toEqual([
      {
        dashboardId: COPY_ID,
        name: "Overview",
        order: 0,
        teamLimited: false,
        teamIds: [],
        widgets: [
          expect.objectContaining({ dashboardId: COPY_ID, kind: "chart", chartId: CHART_ID, order: 0 }),
          expect.objectContaining({ chartId: "clch000000000000000000002", layout: {}, order: 1 }),
        ],
      },
      {
        dashboardId: COPY_ID,
        name: "Sales",
        order: 1,
        teamLimited: true,
        teamIds: ["clte000000000000000000001"],
        widgets: [
          // A chart may sit on two pages of the source, and so of the copy.
          expect.objectContaining({ kind: "chart", chartId: CHART_ID, order: 0 }),
          expect.objectContaining({ kind: "text", chartId: null, content: textContent, order: 1 }),
        ],
      },
    ]);
    expect(tx.dashboard.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: COPY_ID } })
    );
  });

  test("copies pages and widgets in the order the source shows them, numbering tied orders plainly", async () => {
    type TRow = { order: number; createdAt: Date; id: string };
    const sortRows = <T extends TRow>(rows: T[], orderBy: Record<string, "asc" | "desc">[]): T[] =>
      [...rows].sort((a, b) => {
        for (const key of orderBy) {
          const [field, direction] = Object.entries(key)[0] as [keyof TRow, "asc" | "desc"];
          const delta = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
          if (delta !== 0) return direction === "asc" ? delta : -delta;
        }
        return 0;
      });
    const at = (day: number) => new Date(Date.UTC(2026, 0, day));
    const widget = (chartId: string, order: number, day: number) => ({
      id: `w-${chartId}`,
      order,
      createdAt: at(day),
      kind: "chart",
      chartId,
      content: null,
      layout: null,
    });
    // Stored out of display order, with tied orders that the creation time breaks.
    const stored = [
      { id: "p-b", name: "Second", order: 0, createdAt: at(2), teamLimits: [], widgets: [] },
      {
        id: "p-a",
        name: "First",
        order: 0,
        createdAt: at(1),
        teamLimits: [],
        widgets: [widget("late", 3, 1), widget("tie-later", 1, 3), widget("tie-earlier", 1, 2)],
      },
    ];
    tx.dashboard.findUnique.mockImplementation(async ({ select }) => ({
      ...source,
      pages: sortRows(stored, select.pages.orderBy).map((page) => ({
        ...page,
        widgets: sortRows(page.widgets, select.pages.select.widgets.orderBy),
      })),
    }));

    await duplicateDashboardRow({ sourceId: DASHBOARD_ID, createdBy: null, name: "Copy" });

    expect(
      writtenPages().map(({ name, order, widgets }) => ({
        name,
        order,
        widgets: widgets.map(({ chartId, order }) => [chartId, order]),
      }))
    ).toEqual([
      {
        name: "First",
        order: 0,
        widgets: [
          ["tie-earlier", 0],
          ["tie-later", 1],
          ["late", 2],
        ],
      },
      { name: "Second", order: 1, widgets: [] },
    ]);
  });

  test("gives a copy of a dashboard without pages the first page every dashboard has", async () => {
    tx.dashboard.findUnique.mockResolvedValue({ ...source, pages: [] });

    await duplicateDashboardRow({ sourceId: DASHBOARD_ID, createdBy: null, name: "Copy" });

    expect(writtenPages()).toEqual([
      { dashboardId: COPY_ID, name: "Overview", order: 0, teamLimited: false, teamIds: [], widgets: [] },
    ]);
    expect(tx.dashboardPageTeam.createMany).not.toHaveBeenCalled();
    expect(tx.dashboardWidget.createMany).not.toHaveBeenCalled();
  });

  test("keeps a page limited to no team limited in the copy, not open to every team", async () => {
    tx.dashboard.findUnique.mockResolvedValue({
      ...source,
      pages: [{ name: "Closed", teamLimited: true, teamLimits: [], widgets: [] }],
    });

    await duplicateDashboardRow({ sourceId: DASHBOARD_ID, createdBy: null, name: "Copy" });

    expect(writtenPages()).toEqual([
      { dashboardId: COPY_ID, name: "Closed", order: 0, teamLimited: true, teamIds: [], widgets: [] },
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

describe("listReadableDashboardRows", () => {
  const row = (n: number) => ({ id: `dash-${n}`, createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 5000 - n)) });
  const rows = (from: number, count: number) => Array.from({ length: count }, (_, i) => row(from + i));
  const args = (limit: number, readable: (ids: readonly string[]) => Promise<ReadonlySet<string>>) => ({
    filter: { workspaceId: WORKSPACE_ID },
    cursor: null,
    limit,
    readable,
  });

  beforeEach(() => {
    vi.mocked(prisma.dashboard.findMany).mockReset();
  });

  test("walks candidate batches until the page plus one is full, checking only each batch", async () => {
    vi.mocked(prisma.dashboard.findMany)
      .mockResolvedValueOnce(rows(0, 100) as never)
      .mockResolvedValueOnce(rows(100, 100) as never);
    // Only every 40th dashboard is readable: the first batch keeps 3, the second fills the page.
    const readable = vi.fn(
      async (ids: readonly string[]) => new Set(ids.filter((id) => Number(id.slice(5)) % 40 === 0))
    );

    const result = await listReadableDashboardRows(args(4, readable));

    expect(result.rows.map(({ id }) => id)).toEqual(["dash-0", "dash-40", "dash-80", "dash-120", "dash-160"]);
    expect(result.resumeAfter).toBeNull();
    expect(readable).toHaveBeenCalledTimes(2);
    expect(readable.mock.calls[0][0]).toHaveLength(100);
    expect(vi.mocked(prisma.dashboard.findMany).mock.calls[1][0]!.where).toMatchObject({
      OR: [{ createdAt: { lt: row(99).createdAt } }, { createdAt: row(99).createdAt, id: { lt: "dash-99" } }],
    });
  });

  test("stops when the candidates run out", async () => {
    vi.mocked(prisma.dashboard.findMany).mockResolvedValueOnce(rows(0, 3) as never);
    const result = await listReadableDashboardRows(
      args(
        20,
        vi.fn(async () => new Set(["dash-1"]))
      )
    );
    expect(result).toEqual({ rows: [row(1)], resumeAfter: null });
    expect(prisma.dashboard.findMany).toHaveBeenCalledTimes(1);
  });

  test("reads at most READABLE_SCAN_MAX_ROUNDS batches, and says where to resume", async () => {
    for (let round = 0; round < READABLE_SCAN_MAX_ROUNDS + 2; round++) {
      vi.mocked(prisma.dashboard.findMany).mockResolvedValueOnce(rows(round * 100, 100) as never);
    }
    const result = await listReadableDashboardRows(
      args(
        20,
        vi.fn(async () => new Set<string>())
      )
    );
    expect(prisma.dashboard.findMany).toHaveBeenCalledTimes(READABLE_SCAN_MAX_ROUNDS);
    expect(result.rows).toEqual([]);
    expect(result.resumeAfter).toEqual(row(READABLE_SCAN_MAX_ROUNDS * 100 - 1));
  });
});
