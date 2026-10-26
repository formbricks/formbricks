import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { MAX_DASHBOARD_WIDGETS } from "./schemas";
import {
  addWidgetRow,
  deleteWidgetRow,
  getChartTypeInWorkspace,
  replaceDashboardRow,
  updateWidgetRow,
} from "./widget-service";

/**
 * The decisions the widget writes make inside their transaction: the lock, the chart-at-most-once and
 * no-overlap rules, placement, and the `updatedAt` every write moves. The transaction client is a stub
 * so the callback actually runs; the real-database behaviour lives in the integration suites.
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
const LOCKED_AT = new Date("2026-06-01T12:00:00.000Z");

type TSibling = { id: string; chartId: string; layout: unknown; order: number };

const makeTx = ({
  locked = LOCKED_AT as Date | null,
  siblings = [] as TSibling[],
  touched = 1,
}: { locked?: Date | null; siblings?: TSibling[]; touched?: number } = {}) => ({
  $queryRaw: vi.fn(async () => (locked ? [{ updatedAt: locked }] : [])),
  dashboardWidget: {
    findMany: vi.fn(async () => siblings),
    findFirst: vi.fn(),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "clwg_new", ...data })),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
      id: where.id,
      ...data,
    })),
    deleteMany: vi.fn(async () => ({ count: 1 })),
  },
  dashboard: {
    updateMany: vi.fn(async () => ({ count: touched })),
    findUnique: vi.fn(),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: DASHBOARD_ID, ...data })),
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
  expect(tx.dashboard.update).not.toHaveBeenCalled();
  expect(tx.dashboardWidget.create).not.toHaveBeenCalled();
  expect(tx.dashboardWidget.update).not.toHaveBeenCalled();
  expect(tx.dashboardWidget.deleteMany).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  // The app's clock reads the locked updatedAt, so a write that took plain "now" would leave the token as
  // it was: every touch below must land exactly a millisecond past it.
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

describe("addWidgetRow", () => {
  const sibling: TSibling = { id: "clwg_a", chartId: "clch_a", layout: { x: 0, y: 0, w: 4, h: 4 }, order: 0 };

  test("is gone when the dashboard no longer exists, without reading or writing widgets", async () => {
    const tx = stubTransaction(makeTx({ locked: null }));
    expect(await addWidgetRow({ dashboardId: DASHBOARD_ID, chartId: "clch_b", chartType: "bar" })).toEqual({
      kind: "gone",
    });
    expect(tx.dashboardWidget.findMany).not.toHaveBeenCalled();
    expectNothingWritten(tx);
  });

  test("locks this dashboard's row and reads only its widgets", async () => {
    const tx = stubTransaction(makeTx());
    await addWidgetRow({ dashboardId: DASHBOARD_ID, chartId: "clch_b", chartType: "bar" });
    const [strings, ...values] = tx.$queryRaw.mock.calls[0] as unknown as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(strings.join("?")).toContain("FOR UPDATE");
    expect(values).toEqual([DASHBOARD_ID]);
    expect(tx.dashboardWidget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { dashboardId: DASHBOARD_ID } })
    );
  });

  test("refuses a chart already on the dashboard and writes nothing", async () => {
    const tx = stubTransaction(makeTx({ siblings: [sibling] }));
    expect(await addWidgetRow({ dashboardId: DASHBOARD_ID, chartId: "clch_a", chartType: "bar" })).toEqual({
      kind: "duplicate",
    });
    expectNothingWritten(tx);
  });

  test("refuses an add once the dashboard holds the most widgets a save carries, and writes nothing", async () => {
    const full = Array.from({ length: MAX_DASHBOARD_WIDGETS }, (_, index) => ({
      ...sibling,
      id: `clwg_${index}`,
      chartId: `clch_${index}`,
      layout: { x: 0, y: index, w: 1, h: 1 },
      order: index,
    }));
    const tx = stubTransaction(makeTx({ siblings: full }));
    expect(await addWidgetRow({ dashboardId: DASHBOARD_ID, chartId: "clch_new", chartType: "bar" })).toEqual({
      kind: "full",
    });
    expectNothingWritten(tx);

    stubTransaction(makeTx({ siblings: full.slice(1) }));
    expect(
      (await addWidgetRow({ dashboardId: DASHBOARD_ID, chartId: "clch_new", chartType: "bar" })).kind
    ).toBe("ok");
  });

  test("refuses a layout that covers a widget, naming it, and writes nothing", async () => {
    const tx = stubTransaction(makeTx({ siblings: [sibling] }));
    expect(
      await addWidgetRow({
        dashboardId: DASHBOARD_ID,
        chartId: "clch_b",
        chartType: "bar",
        layout: { x: 2, y: 2, w: 4, h: 4 },
      })
    ).toEqual({ kind: "overlap", widgetId: "clwg_a" });
    expectNothingWritten(tx);
  });

  test("puts a chart exactly at a free layout, after the highest order, and moves updatedAt", async () => {
    const tx = stubTransaction(
      makeTx({ siblings: [sibling, { ...sibling, id: "clwg_c", chartId: "clch_c", layout: null, order: 3 }] })
    );
    const layout = { x: 8, y: 10, w: 4, h: 3 };
    const result = await addWidgetRow({
      dashboardId: DASHBOARD_ID,
      chartId: "clch_b",
      chartType: "bar",
      layout,
    });

    expect(result.kind).toBe("ok");
    expect(tx.dashboardWidget.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { dashboardId: DASHBOARD_ID, chartId: "clch_b", layout, order: 4 } })
    );
    expect(tx.dashboard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: DASHBOARD_ID } })
    );
    expect(touchedAt(tx).getTime()).toBe(LOCKED_AT.getTime() + 1);
  });

  test("without a layout, places the chart in the first open slot at its type's default size", async () => {
    const tx = stubTransaction(makeTx({ siblings: [sibling] }));
    await addWidgetRow({ dashboardId: DASHBOARD_ID, chartId: "clch_b", chartType: "big_number" });
    expect(tx.dashboardWidget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ layout: { x: 4, y: 0, w: 3, h: 2 }, order: 1 }),
      })
    );
  });

  test("starts an empty dashboard at the origin with order 0", async () => {
    const tx = stubTransaction(makeTx());
    await addWidgetRow({ dashboardId: DASHBOARD_ID, chartId: "clch_b", chartType: "bar" });
    expect(tx.dashboardWidget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ layout: { x: 0, y: 0, w: 4, h: 4 }, order: 0 }),
      })
    );
  });

  test("is gone, and creates nothing, when the dashboard vanished before it could be touched", async () => {
    const tx = stubTransaction(makeTx({ touched: 0 }));
    expect(await addWidgetRow({ dashboardId: DASHBOARD_ID, chartId: "clch_b", chartType: "bar" })).toEqual({
      kind: "gone",
    });
    expect(tx.dashboardWidget.create).not.toHaveBeenCalled();
  });

  test("runs the transaction again after a deadlock", async () => {
    const tx = makeTx();
    mockTransaction
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("deadlock", { code: "P2034", clientVersion: "7" })
      )
      .mockImplementationOnce(async (callback: (client: TTx) => unknown) => callback(tx));

    const result = await addWidgetRow({ dashboardId: DASHBOARD_ID, chartId: "clch_b", chartType: "bar" });
    expect(result.kind).toBe("ok");
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });
});

describe("updateWidgetRow", () => {
  const mine: TSibling = {
    id: "clwg_mine",
    chartId: "clch_mine",
    layout: { x: 0, y: 0, w: 4, h: 4 },
    order: 0,
  };
  const other: TSibling = {
    id: "clwg_other",
    chartId: "clch_other",
    layout: { x: 4, y: 0, w: 4, h: 4 },
    order: 1,
  };

  test("is gone when the dashboard no longer exists", async () => {
    const tx = stubTransaction(makeTx({ locked: null }));
    expect(
      await updateWidgetRow({ dashboardId: DASHBOARD_ID, widgetId: mine.id, chartId: "clch_x" })
    ).toEqual({
      kind: "gone",
    });
    expectNothingWritten(tx);
  });

  test("is gone for a widget that is not on this dashboard", async () => {
    const tx = stubTransaction(makeTx({ siblings: [other] }));
    expect(
      await updateWidgetRow({
        dashboardId: DASHBOARD_ID,
        widgetId: mine.id,
        layout: { x: 0, y: 4, w: 4, h: 4 },
      })
    ).toEqual({ kind: "gone" });
    expectNothingWritten(tx);
  });

  test("refuses repointing to a chart another widget on the dashboard shows", async () => {
    const tx = stubTransaction(makeTx({ siblings: [mine, other] }));
    expect(
      await updateWidgetRow({ dashboardId: DASHBOARD_ID, widgetId: mine.id, chartId: "clch_other" })
    ).toEqual({ kind: "duplicate" });
    expectNothingWritten(tx);
  });

  test("refuses a move onto another widget, naming it", async () => {
    const tx = stubTransaction(makeTx({ siblings: [mine, other] }));
    expect(
      await updateWidgetRow({
        dashboardId: DASHBOARD_ID,
        widgetId: mine.id,
        layout: { x: 3, y: 0, w: 4, h: 4 },
      })
    ).toEqual({ kind: "overlap", widgetId: other.id });
    expectNothingWritten(tx);
  });

  test("checks the move against the other widgets only, so overlapping its own old place is fine", async () => {
    const tx = stubTransaction(makeTx({ siblings: [mine, other] }));
    const layout = { x: 0, y: 2, w: 4, h: 4 };
    const result = await updateWidgetRow({ dashboardId: DASHBOARD_ID, widgetId: mine.id, layout });

    expect(result).toMatchObject({
      kind: "ok",
      previous: { chartId: mine.chartId, layout: mine.layout },
    });
    expect(tx.dashboardWidget.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mine.id }, data: { layout } })
    );
    expect(touchedAt(tx).getTime()).toBe(LOCKED_AT.getTime() + 1);
  });

  test("repoints in place, writing only the chart, and returns what it showed before", async () => {
    const tx = stubTransaction(makeTx({ siblings: [mine, other] }));
    const result = await updateWidgetRow({
      dashboardId: DASHBOARD_ID,
      widgetId: mine.id,
      chartId: "clch_new",
    });

    expect(result).toMatchObject({ kind: "ok", previous: { chartId: "clch_mine", layout: mine.layout } });
    expect(tx.dashboardWidget.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mine.id }, data: { chartId: "clch_new" } })
    );
  });

  test("is gone, and updates nothing, when the dashboard vanished before it could be touched", async () => {
    const tx = stubTransaction(makeTx({ siblings: [mine], touched: 0 }));
    expect(
      await updateWidgetRow({ dashboardId: DASHBOARD_ID, widgetId: mine.id, chartId: "clch_new" })
    ).toEqual({
      kind: "gone",
    });
    expect(tx.dashboardWidget.update).not.toHaveBeenCalled();
  });
});

describe("deleteWidgetRow", () => {
  const removed = { chartId: "clch_a", layout: { x: 0, y: 0, w: 4, h: 4 } };

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

  test("is null, and leaves updatedAt alone, when the widget was deleted concurrently", async () => {
    const tx = stubTransaction(makeTx());
    tx.dashboardWidget.findFirst.mockResolvedValueOnce(removed);
    tx.dashboardWidget.deleteMany.mockResolvedValueOnce({ count: 0 });
    expect(await deleteWidgetRow(DASHBOARD_ID, "clwg_a")).toBeNull();
    expect(tx.dashboard.updateMany).not.toHaveBeenCalled();
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

  test("runs the transaction again after a deadlock, like every other widget write", async () => {
    const tx = makeTx();
    tx.dashboardWidget.findFirst.mockResolvedValueOnce(removed);
    mockTransaction
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("deadlock", { code: "P2034", clientVersion: "7" })
      )
      .mockImplementationOnce(async (callback: (client: TTx) => unknown) => callback(tx));

    expect(await deleteWidgetRow(DASHBOARD_ID, "clwg_a")).toEqual(removed);
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });
});

describe("replaceDashboardRow", () => {
  const widgetA = { id: "clwg_a", layout: { x: 0, y: 0, w: 4, h: 4 }, order: 0 };
  const widgetB = { id: "clwg_b", layout: { x: 4, y: 0, w: 4, h: 4 }, order: 1 };
  const current = { name: "Board", updatedAt: LOCKED_AT, widgets: [widgetA, widgetB] };

  const txWith = (found: typeof current | null = current, locked: Date | null = LOCKED_AT) => {
    const tx = stubTransaction(makeTx({ locked }));
    tx.dashboard.findUnique.mockResolvedValue(found);
    return tx;
  };

  test("is gone when the dashboard cannot be locked", async () => {
    const tx = txWith(current, null);
    expect(
      await replaceDashboardRow({ dashboardId: DASHBOARD_ID, expectedUpdatedAt: LOCKED_AT, widgets: [] })
    ).toEqual({ kind: "gone" });
    expect(tx.dashboard.findUnique).not.toHaveBeenCalled();
  });

  test("is gone when the dashboard cannot be read after the lock", async () => {
    const tx = txWith(null);
    expect(
      await replaceDashboardRow({ dashboardId: DASHBOARD_ID, expectedUpdatedAt: LOCKED_AT, widgets: [] })
    ).toEqual({ kind: "gone" });
    expectNothingWritten(tx);
  });

  test("refuses a stale version, naming the current one, and writes nothing", async () => {
    const tx = txWith();
    expect(
      await replaceDashboardRow({
        dashboardId: DASHBOARD_ID,
        expectedUpdatedAt: new Date(LOCKED_AT.getTime() - 1),
        widgets: [],
      })
    ).toEqual({ kind: "stale", currentUpdatedAt: LOCKED_AT });
    expectNothingWritten(tx);
  });

  test("refuses widgets that are not on the dashboard, naming them", async () => {
    const tx = txWith();
    expect(
      await replaceDashboardRow({
        dashboardId: DASHBOARD_ID,
        expectedUpdatedAt: LOCKED_AT,
        widgets: [
          { widgetId: widgetA.id, layout: widgetA.layout },
          { widgetId: "clwg_foreign", layout: { x: 0, y: 4, w: 4, h: 4 } },
        ],
      })
    ).toEqual({ kind: "unknownWidgets", widgetIds: ["clwg_foreign"] });
    expectNothingWritten(tx);
  });

  test("with requireEveryWidget, refuses a list that leaves a widget out, and removes nothing", async () => {
    const tx = txWith();
    expect(
      await replaceDashboardRow({
        dashboardId: DASHBOARD_ID,
        expectedUpdatedAt: LOCKED_AT,
        widgets: [{ widgetId: widgetA.id, layout: widgetA.layout }],
        requireEveryWidget: true,
      })
    ).toEqual({ kind: "missingWidgets", widgetIds: [widgetB.id] });
    expectNothingWritten(tx);
  });

  test("refuses overlapping widgets, naming both, and writes nothing", async () => {
    const tx = txWith();
    expect(
      await replaceDashboardRow({
        dashboardId: DASHBOARD_ID,
        expectedUpdatedAt: LOCKED_AT,
        widgets: [
          { widgetId: widgetA.id, layout: { x: 0, y: 0, w: 6, h: 4 } },
          { widgetId: widgetB.id, layout: { x: 5, y: 0, w: 4, h: 4 } },
        ],
      })
    ).toEqual({ kind: "overlap", widgetIds: [widgetB.id, widgetA.id] });
    expectNothingWritten(tx);
  });

  test("saves name and places, removes an omitted widget, and moves updatedAt past the locked value", async () => {
    // The clock stands still at the locked value: the save must still move updatedAt.
    vi.useFakeTimers({ now: LOCKED_AT, toFake: ["Date"] });
    const tx = txWith();
    const moved = { x: 0, y: 4, w: 6, h: 4 };

    const result = await replaceDashboardRow({
      dashboardId: DASHBOARD_ID,
      expectedUpdatedAt: new Date(LOCKED_AT.getTime()),
      name: "Renamed",
      widgets: [{ widgetId: widgetA.id, layout: moved, order: 5 }],
    });

    expect(result).toMatchObject({
      kind: "ok",
      previous: { name: "Board", widgets: [widgetA, widgetB] },
    });
    expect(tx.dashboardWidget.deleteMany).toHaveBeenCalledWith({
      where: { dashboardId: DASHBOARD_ID, id: { in: [widgetB.id] } },
    });
    expect(tx.dashboardWidget.update).toHaveBeenCalledTimes(1);
    expect(tx.dashboardWidget.update).toHaveBeenCalledWith({
      where: { id: widgetA.id },
      data: { layout: moved, order: 5 },
    });
    expect(tx.dashboard.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DASHBOARD_ID },
        data: { name: "Renamed", updatedAt: new Date(LOCKED_AT.getTime() + 1) },
      })
    );
  });

  test("keeps the name and each order when they are omitted, and deletes nothing when every widget is sent", async () => {
    const tx = txWith();
    await replaceDashboardRow({
      dashboardId: DASHBOARD_ID,
      expectedUpdatedAt: LOCKED_AT,
      widgets: [
        { widgetId: widgetA.id, layout: widgetA.layout },
        { widgetId: widgetB.id, layout: widgetB.layout },
      ],
      requireEveryWidget: true,
    });

    expect(tx.dashboardWidget.deleteMany).not.toHaveBeenCalled();
    expect(tx.dashboardWidget.update.mock.calls.map(([args]) => args)).toEqual([
      { where: { id: widgetA.id }, data: { layout: widgetA.layout } },
      { where: { id: widgetB.id }, data: { layout: widgetB.layout } },
    ]);
    const [[dashboardUpdate]] = tx.dashboard.update.mock.calls as unknown as [[{ data: object }]];
    expect(dashboardUpdate.data).not.toHaveProperty("name");
    expect(dashboardUpdate.data).toHaveProperty("updatedAt");
  });
});
