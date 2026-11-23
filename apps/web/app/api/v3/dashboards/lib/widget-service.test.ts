import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { getDefaultBlockLayout } from "@/modules/ee/analysis/dashboards/lib/widget-blocks";
import { getDefaultWidgetLayout } from "@/modules/ee/analysis/dashboards/lib/widget-placement";
import { MAX_DASHBOARD_WIDGETS, MAX_WIDGET_ORDER } from "./schemas";
import {
  addWidgetRow,
  deleteWidgetRow,
  getChartTypeInWorkspace,
  planNewWidget,
  updateWidgetRow,
} from "./widget-service";

/**
 * The decisions the widget writes make inside their transaction: the lock, the page they write to, the
 * chart-at-most-once-per-page and no-overlap rules, placement, block content, and the `updatedAt` every
 * write moves. The transaction client is a stub so the callback actually runs; the real-database
 * behaviour lives in the integration suites.
 */

vi.mock("server-only", () => ({}));

const { mockTransaction, mockChartFindFirst } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockChartFindFirst: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: mockTransaction,
    chart: { findFirst: mockChartFindFirst },
  },
}));

const DASHBOARD_ID = "cldb000000000000000000001";
const WORKSPACE_ID = "clws000000000000000000001";
const PAGE_ID = "clpg000000000000000000001";
const OTHER_PAGE_ID = "clpg000000000000000000002";
const LOCKED_AT = new Date("2026-06-01T12:00:00.000Z");
const BAR_SIZE = getDefaultWidgetLayout("bar");

type TSibling = { id: string; chartId: string | null; layout: unknown; order: number };

const makeTx = ({
  locked = LOCKED_AT,
  siblings = [] as TSibling[],
  count,
  pageId = PAGE_ID,
  touched = 1,
}: {
  locked?: Date | null;
  siblings?: TSibling[];
  count?: number;
  pageId?: string | null;
  touched?: number;
} = {}) => ({
  $queryRaw: vi.fn(async () => (locked ? [{ updatedAt: locked }] : [])),
  $executeRaw: vi.fn(async () => 1),
  dashboardPage: {
    findFirst: vi.fn(async () => (pageId ? { id: pageId } : null)),
  },
  dashboardWidget: {
    findMany: vi.fn(async () => siblings),
    findFirst: vi.fn(),
    count: vi.fn(async () => count ?? siblings.length),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "clwg_new", ...data })),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
      id: where.id,
      ...data,
    })),
    deleteMany: vi.fn(async () => ({ count: 1 })),
  },
  dashboard: {
    updateMany: vi.fn(async () => ({ count: touched })),
  },
});

type TTx = ReturnType<typeof makeTx>;

const stubTransaction = (tx: TTx) => {
  mockTransaction.mockImplementation(async (callback: (client: TTx) => unknown) => callback(tx));
  return tx;
};

/** The `updatedAt` the write gave the dashboard through `touchDashboard`. */
const touchedAt = (tx: TTx): Date => {
  const [[call]] = tx.dashboard.updateMany.mock.calls as unknown as [[{ data: { updatedAt: Date } }]];
  return call.data.updatedAt;
};

const expectNothingWritten = (tx: TTx) => {
  expect(tx.dashboard.updateMany).not.toHaveBeenCalled();
  expect(tx.dashboardWidget.create).not.toHaveBeenCalled();
  expect(tx.dashboardWidget.update).not.toHaveBeenCalled();
  expect(tx.dashboardWidget.deleteMany).not.toHaveBeenCalled();
};

const addChart = (chartId: string, extra: Partial<Parameters<typeof addWidgetRow>[0]> = {}) =>
  addWidgetRow({
    dashboardId: DASHBOARD_ID,
    kind: "chart",
    chartId,
    content: null,
    size: BAR_SIZE,
    ...extra,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: LOCKED_AT, toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getChartTypeInWorkspace", () => {
  test("looks the chart up only inside the given workspace", async () => {
    mockChartFindFirst.mockResolvedValueOnce({ type: "bar" });
    expect(await getChartTypeInWorkspace("clch1", "clws1")).toBe("bar");
    expect(mockChartFindFirst).toHaveBeenCalledWith({
      where: { id: "clch1", workspaceId: "clws1" },
      select: { type: true },
    });
  });

  test("is null for a chart that is not in the workspace", async () => {
    mockChartFindFirst.mockResolvedValueOnce(null);
    expect(await getChartTypeInWorkspace("clch1", "clws_other")).toBeNull();
  });
});

describe("planNewWidget", () => {
  test("refuses once the dashboard holds the most widgets, counting every page", () => {
    expect(planNewWidget({ siblings: [], widgetCount: MAX_DASHBOARD_WIDGETS, size: BAR_SIZE })).toEqual({
      kind: "full",
    });
  });

  test("never numbers a new widget past the order column", () => {
    const plan = planNewWidget({
      siblings: [{ id: "a", layout: { x: 0, y: 0, w: 4, h: 4 }, order: MAX_WIDGET_ORDER }],
      widgetCount: 1,
      size: BAR_SIZE,
    });
    expect(plan).toMatchObject({ kind: "ok", order: MAX_WIDGET_ORDER });
  });
});

describe("addWidgetRow", () => {
  const sibling: TSibling = { id: "clwg_a", chartId: "clch_a", layout: { x: 0, y: 0, w: 4, h: 4 }, order: 0 };

  test("is gone when the dashboard no longer exists, without reading or writing widgets", async () => {
    const tx = stubTransaction(makeTx({ locked: null }));
    expect(await addChart("clch_b")).toEqual({ kind: "gone" });
    expect(tx.dashboardWidget.findMany).not.toHaveBeenCalled();
    expectNothingWritten(tx);
  });

  test("locks this dashboard's row and reads only the target page's widgets", async () => {
    const tx = stubTransaction(makeTx());
    await addChart("clch_b");
    const [strings, ...values] = tx.$queryRaw.mock.calls[0] as unknown as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(strings.join("?")).toContain("FOR UPDATE");
    expect(values).toEqual([DASHBOARD_ID]);
    expect(tx.dashboardWidget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { dashboardId: DASHBOARD_ID, pageId: PAGE_ID } })
    );
  });

  test("without a pageId, writes to the dashboard's first page by order", async () => {
    const tx = stubTransaction(makeTx());
    await addChart("clch_b");
    expect(tx.dashboardPage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { dashboardId: DASHBOARD_ID } })
    );
    expect(tx.dashboardWidget.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pageId: PAGE_ID, kind: "chart" }) })
    );
  });

  test("looks a named page up on this dashboard, and refuses one that is not", async () => {
    const tx = stubTransaction(makeTx({ pageId: null }));
    expect(await addChart("clch_b", { pageId: OTHER_PAGE_ID })).toEqual({ kind: "unknownPage" });
    expect(tx.dashboardPage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { dashboardId: DASHBOARD_ID, id: OTHER_PAGE_ID } })
    );
    expectNothingWritten(tx);
  });

  test("refuses a chart already on that page and writes nothing", async () => {
    const tx = stubTransaction(makeTx({ siblings: [sibling] }));
    expect(await addChart("clch_a")).toEqual({ kind: "duplicate" });
    expectNothingWritten(tx);
  });

  test("refuses an add once the dashboard is full, counting widgets on every page", async () => {
    const tx = stubTransaction(makeTx({ count: MAX_DASHBOARD_WIDGETS }));
    expect(await addChart("clch_new")).toEqual({ kind: "full" });
    expectNothingWritten(tx);
  });

  test("refuses a layout that covers a widget, naming it, and writes nothing", async () => {
    const tx = stubTransaction(makeTx({ siblings: [sibling] }));
    expect(await addChart("clch_b", { layout: { x: 2, y: 2, w: 4, h: 4 } })).toEqual({
      kind: "overlap",
      widgetId: "clwg_a",
    });
    expectNothingWritten(tx);
  });

  test("puts a chart exactly at a free layout, after the highest order, and moves updatedAt", async () => {
    const tx = stubTransaction(
      makeTx({ siblings: [sibling, { ...sibling, id: "clwg_c", chartId: "clch_c", layout: null, order: 3 }] })
    );
    const layout = { x: 8, y: 10, w: 4, h: 3 };
    const result = await addChart("clch_b", { layout });

    expect(result.kind).toBe("ok");
    expect(tx.dashboardWidget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          dashboardId: DASHBOARD_ID,
          pageId: PAGE_ID,
          kind: "chart",
          chartId: "clch_b",
          content: Prisma.DbNull,
          layout,
          order: 4,
        },
      })
    );
    expect(touchedAt(tx).getTime()).toBe(LOCKED_AT.getTime() + 1);
  });

  test("without a layout, places the widget in the first open slot at the size it is given", async () => {
    const tx = stubTransaction(makeTx({ siblings: [sibling] }));
    await addChart("clch_b", { size: getDefaultWidgetLayout("big_number") });
    expect(tx.dashboardWidget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ layout: { x: 4, y: 0, w: 3, h: 2 }, order: 1 }),
      })
    );
  });

  test("adds a layout block with its content and no chart", async () => {
    const tx = stubTransaction(makeTx());
    const content = { headline: "Q3", description: "" };
    await addWidgetRow({
      dashboardId: DASHBOARD_ID,
      kind: "text",
      chartId: "clch_ignored",
      content,
      size: getDefaultBlockLayout("text"),
    });
    expect(tx.dashboardWidget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "text",
          chartId: null,
          content,
          layout: { x: 0, y: 0, w: 9, h: 2 },
        }),
      })
    );
  });

  test("is gone, and creates nothing, when the dashboard vanished before it could be touched", async () => {
    const tx = stubTransaction(makeTx({ touched: 0 }));
    expect(await addChart("clch_b")).toEqual({ kind: "gone" });
    expect(tx.dashboardWidget.create).not.toHaveBeenCalled();
  });

  test("runs the transaction again after a deadlock", async () => {
    const tx = makeTx();
    mockTransaction
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("deadlock", { code: "P2034", clientVersion: "7" })
      )
      .mockImplementationOnce(async (callback: (client: TTx) => unknown) => callback(tx));

    expect((await addChart("clch_b")).kind).toBe("ok");
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });
});

describe("updateWidgetRow", () => {
  const mine = {
    id: "clwg_mine",
    pageId: PAGE_ID,
    kind: "chart" as const,
    chartId: "clch_mine",
    layout: { x: 0, y: 0, w: 4, h: 4 },
    content: null,
    order: 0,
  };
  const other: TSibling = {
    id: "clwg_other",
    chartId: "clch_other",
    layout: { x: 4, y: 0, w: 4, h: 4 },
    order: 1,
  };

  const update = (extra: Partial<Parameters<typeof updateWidgetRow>[0]>) =>
    updateWidgetRow({ dashboardId: DASHBOARD_ID, workspaceId: WORKSPACE_ID, widgetId: mine.id, ...extra });

  const txWith = (current: unknown, siblings: TSibling[] = [mine, other]) => {
    const tx = stubTransaction(makeTx({ siblings }));
    tx.dashboardWidget.findFirst.mockResolvedValue(current);
    return tx;
  };

  test("is gone when the dashboard no longer exists", async () => {
    const tx = stubTransaction(makeTx({ locked: null }));
    expect(await update({ chartId: "clch_x" })).toEqual({ kind: "gone" });
    expectNothingWritten(tx);
  });

  test("is gone for a widget that is not on this dashboard", async () => {
    const tx = txWith(null);
    expect(await update({ layout: { x: 0, y: 4, w: 4, h: 4 } })).toEqual({ kind: "gone" });
    expect(tx.dashboardWidget.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mine.id, dashboardId: DASHBOARD_ID } })
    );
    expectNothingWritten(tx);
  });

  test("refuses repointing to a chart another widget on its page shows", async () => {
    const tx = txWith(mine);
    expect(await update({ chartId: "clch_other" })).toEqual({ kind: "duplicate" });
    expectNothingWritten(tx);
  });

  test("refuses a chart for a layout block, and content for a chart", async () => {
    let tx = txWith({ ...mine, kind: "separator", chartId: null });
    expect(await update({ chartId: "clch_x" })).toMatchObject({ kind: "invalidWidget", name: "chartId" });
    expectNothingWritten(tx);

    tx = txWith(mine);
    expect(await update({ content: { headline: "x" } })).toMatchObject({
      kind: "invalidWidget",
      name: "content",
    });
    expectNothingWritten(tx);
  });

  test("merges a block's content: an image keeps its file when only its settings change", async () => {
    const fileUrl = `/storage/${WORKSPACE_ID}/private/dashboards/cldb1/photo--fid--1.png`;
    const tx = txWith({
      ...mine,
      kind: "image",
      chartId: null,
      content: { fileUrl, fit: "fit", position: "center", alt: "" },
    });
    expect((await update({ content: { fit: "fill", alt: "Team" } })).kind).toBe("ok");
    expect(tx.dashboardWidget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { content: { fileUrl, fit: "fill", position: "center", alt: "Team" } },
      })
    );
  });

  test("refuses an image file that is not a dashboard upload of this workspace", async () => {
    const tx = txWith({ ...mine, kind: "image", chartId: null, content: null });
    expect(await update({ content: { fileUrl: "https://evil.example/x.png" } })).toMatchObject({
      kind: "invalidWidget",
      name: "content",
    });
    expectNothingWritten(tx);
  });

  test("refuses a move onto another widget, naming it", async () => {
    const tx = txWith(mine);
    expect(await update({ layout: { x: 3, y: 0, w: 4, h: 4 } })).toEqual({
      kind: "overlap",
      widgetId: other.id,
    });
    expectNothingWritten(tx);
  });

  test("checks the move against the other widgets only, so overlapping its own old place is fine", async () => {
    const tx = txWith(mine);
    const layout = { x: 0, y: 2, w: 4, h: 4 };
    const result = await update({ layout });

    expect(result).toMatchObject({ kind: "ok", previous: { chartId: mine.chartId, layout: mine.layout } });
    expect(tx.dashboardWidget.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mine.id }, data: { layout } })
    );
    expect(touchedAt(tx).getTime()).toBe(LOCKED_AT.getTime() + 1);
  });

  test("moves a widget to another page, into its first open slot at its size", async () => {
    const tx = txWith(mine, [other]);
    tx.dashboardPage.findFirst.mockResolvedValueOnce({ id: OTHER_PAGE_ID });
    expect((await update({ pageId: OTHER_PAGE_ID })).kind).toBe("ok");
    expect(tx.dashboardWidget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { pageId: OTHER_PAGE_ID, layout: { x: 0, y: 0, w: 4, h: 4 } },
      })
    );
  });

  test("refuses a move to a page of another dashboard", async () => {
    const tx = txWith(mine);
    tx.dashboardPage.findFirst.mockResolvedValueOnce(null);
    expect(await update({ pageId: OTHER_PAGE_ID })).toEqual({ kind: "unknownPage" });
    expectNothingWritten(tx);
  });

  test("repoints in place, writing only the chart", async () => {
    const tx = txWith(mine);
    expect(await update({ chartId: "clch_new" })).toMatchObject({ kind: "ok" });
    expect(tx.dashboardWidget.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mine.id }, data: { chartId: "clch_new" } })
    );
  });

  test("is gone, and updates nothing, when the dashboard vanished before it could be touched", async () => {
    const tx = stubTransaction(makeTx({ siblings: [mine], touched: 0 }));
    tx.dashboardWidget.findFirst.mockResolvedValue(mine);
    expect(await update({ chartId: "clch_new" })).toEqual({ kind: "gone" });
    expect(tx.dashboardWidget.update).not.toHaveBeenCalled();
  });
});

describe("deleteWidgetRow", () => {
  const removed = { pageId: PAGE_ID, kind: "chart", chartId: "clch_a", layout: { x: 0, y: 0, w: 4, h: 4 } };

  test("is null when the dashboard no longer exists", async () => {
    const tx = stubTransaction(makeTx({ locked: null }));
    expect(await deleteWidgetRow(DASHBOARD_ID, "clwg_a")).toBeNull();
    expect(tx.dashboardWidget.findFirst).not.toHaveBeenCalled();
    expectNothingWritten(tx);
  });

  test("looks the widget up on this dashboard only, and is null when it is not there", async () => {
    const tx = stubTransaction(makeTx());
    tx.dashboardWidget.findFirst.mockResolvedValueOnce(null);
    expect(await deleteWidgetRow(DASHBOARD_ID, "clwg_elsewhere")).toBeNull();
    expect(tx.dashboardWidget.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "clwg_elsewhere", dashboardId: DASHBOARD_ID } })
    );
    expectNothingWritten(tx);
  });

  test("deletes the widget scoped to the dashboard, moves updatedAt, and returns what was removed", async () => {
    const tx = stubTransaction(makeTx());
    tx.dashboardWidget.findFirst.mockResolvedValueOnce(removed);
    expect(await deleteWidgetRow(DASHBOARD_ID, "clwg_a")).toEqual(removed);
    expect(tx.dashboardWidget.deleteMany).toHaveBeenCalledWith({
      where: { id: "clwg_a", dashboardId: DASHBOARD_ID },
    });
    expect(touchedAt(tx).getTime()).toBe(LOCKED_AT.getTime() + 1);
  });
});
