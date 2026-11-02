import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { duplicateChartRow } from "./duplicate-service";
import { selectChartResource } from "./service";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: { $transaction: vi.fn() },
}));

const sourceId = "clch000000000000000000001";
const copyId = "clch000000000000000000002";
const workspaceId = "clws000000000000000000001";
const datasetId = "clds000000000000000000001";
const dashboardId = "cldb000000000000000000001";
const LOCKED_AT = new Date("2026-01-01T00:00:00.000Z");

const SOURCE = {
  name: "Weekly NPS",
  type: "bar",
  query: { measures: ["FeedbackRecords.npsScore"] },
  config: { showLegend: false },
  workspaceId,
  feedbackDirectoryId: datasetId,
};

/**
 * The transaction client the copy runs against. `locked` is what the dashboard lock reads, `siblings` the
 * dashboard's widgets, `touched` how many dashboard rows the `updatedAt` bump hit.
 */
const fakeTx = ({
  source = SOURCE as typeof SOURCE | null,
  takenNames = [] as string[],
  locked = [{ updatedAt: LOCKED_AT }] as { updatedAt: Date }[],
  siblings = [] as { id: string; chartId: string; layout: unknown; order: number }[],
  touched = 1,
} = {}) => ({
  $queryRaw: vi.fn().mockResolvedValue(locked),
  chart: {
    findUnique: vi.fn().mockResolvedValue(source),
    findMany: vi.fn().mockResolvedValue(takenNames.map((name) => ({ name }))),
    create: vi.fn().mockResolvedValue({ id: copyId }),
    findUniqueOrThrow: vi.fn().mockResolvedValue({ id: copyId, name: "read back" }),
  },
  dashboard: { updateMany: vi.fn().mockResolvedValue({ count: touched }) },
  dashboardWidget: {
    findMany: vi.fn().mockResolvedValue(siblings),
    create: vi.fn().mockResolvedValue({ id: "clwg000000000000000000009" }),
  },
});

const runWith = (tx: ReturnType<typeof fakeTx>) => {
  vi.mocked(prisma.$transaction).mockImplementation((async (run: (client: typeof tx) => unknown) =>
    run(tx)) as never);
  return tx;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("duplicateChartRow without a dashboard", () => {
  test("escapes the name for the copy-name lookup, so a backslash or wildcard in it matches itself", async () => {
    const tx = runWith(fakeTx({ takenNames: [] }));
    tx.chart.findUnique.mockResolvedValueOnce({ ...SOURCE, name: String.raw`Q3 \ Q4 100%_done` });

    await duplicateChartRow({ sourceId, createdBy: "user_1" });

    expect(tx.chart.findMany).toHaveBeenCalledWith({
      where: { workspaceId, name: { startsWith: String.raw`Q3 \\ Q4 100\%\_done (copy` } },
      select: { name: true },
    });
  });

  test("copies the source under the first free (copy) name of its workspace", async () => {
    const tx = runWith(fakeTx({ takenNames: ["Weekly NPS (copy)"] }));

    const result = await duplicateChartRow({ sourceId, createdBy: "user_1" });

    expect(result).toEqual({ kind: "ok", row: { id: copyId, name: "read back" } });
    expect(tx.chart.findMany).toHaveBeenCalledWith({
      where: { workspaceId, name: { startsWith: "Weekly NPS (copy" } },
      select: { name: true },
    });
    expect(tx.chart.create).toHaveBeenCalledWith({
      data: {
        name: "Weekly NPS (copy 2)",
        type: "bar",
        query: SOURCE.query,
        config: SOURCE.config,
        workspaceId,
        feedbackDirectoryId: datasetId,
        createdBy: "user_1",
      },
      select: { id: true },
    });
    expect(tx.chart.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: copyId },
      select: selectChartResource,
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.dashboardWidget.create).not.toHaveBeenCalled();
  });

  test("uses the caller's name as given, and stores missing display settings as empty", async () => {
    const tx = runWith(fakeTx({ source: { ...SOURCE, config: null as never } }));

    await duplicateChartRow({ sourceId, name: "Mine", createdBy: null });

    expect(tx.chart.findMany).not.toHaveBeenCalled();
    expect(tx.chart.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Mine", config: {}, createdBy: null }),
      })
    );
  });

  test("reports a source deleted since it was authorized as gone, and copies nothing", async () => {
    const tx = runWith(fakeTx({ source: null }));

    expect(await duplicateChartRow({ sourceId, createdBy: null })).toEqual({ kind: "gone" });
    expect(tx.chart.create).not.toHaveBeenCalled();
  });
});

describe("duplicateChartRow onto a dashboard", () => {
  const SIBLING = {
    id: "clwg000000000000000000001",
    chartId: sourceId,
    layout: { x: 0, y: 0, w: 6, h: 4 },
    order: 0,
  };

  test("puts the copy in the first open slot after the dashboard's widgets, and bumps the dashboard", async () => {
    const tx = runWith(fakeTx({ siblings: [SIBLING] }));

    const result = await duplicateChartRow({ sourceId, createdBy: null, dashboardId });

    expect(result).toEqual({
      kind: "ok",
      row: { id: copyId, name: "read back" },
      widgetId: "clwg000000000000000000009",
    });
    const [strings, ...values] = tx.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(strings.join("?")).toContain("FOR UPDATE");
    expect(values).toEqual([dashboardId]);
    expect(tx.dashboardWidget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { dashboardId } })
    );
    expect(tx.dashboard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: dashboardId } })
    );
    expect(tx.dashboardWidget.create).toHaveBeenCalledWith({
      data: { dashboardId, chartId: copyId, layout: { x: 6, y: 0, w: 4, h: 4 }, order: 1 },
      select: { id: true },
    });
    // Read back after the widget exists, so the copy embeds the dashboard it was put on.
    expect(tx.dashboardWidget.create.mock.invocationCallOrder[0]).toBeLessThan(
      tx.chart.findUniqueOrThrow.mock.invocationCallOrder[0]
    );
  });

  test("places the copy exactly at a free layout", async () => {
    const tx = runWith(fakeTx({ siblings: [SIBLING] }));
    const layout = { x: 0, y: 4, w: 4, h: 4 };

    await duplicateChartRow({ sourceId, createdBy: null, dashboardId, layout });

    expect(tx.dashboardWidget.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ layout, order: 1 }) })
    );
  });

  test("refuses a layout over another widget, leaving no copy and the dashboard untouched", async () => {
    const tx = runWith(fakeTx({ siblings: [SIBLING] }));

    const result = await duplicateChartRow({
      sourceId,
      createdBy: null,
      dashboardId,
      layout: { x: 2, y: 2, w: 4, h: 4 },
    });

    expect(result).toEqual({ kind: "overlap", widgetId: SIBLING.id });
    expect(tx.dashboard.updateMany).not.toHaveBeenCalled();
    expect(tx.chart.create).not.toHaveBeenCalled();
  });

  test("reports a dashboard deleted before the lock, or before the bump, as gone, copying nothing", async () => {
    const unlocked = runWith(fakeTx({ locked: [] }));
    expect(await duplicateChartRow({ sourceId, createdBy: null, dashboardId })).toEqual({ kind: "gone" });
    expect(unlocked.dashboardWidget.findMany).not.toHaveBeenCalled();
    expect(unlocked.chart.create).not.toHaveBeenCalled();

    const untouched = runWith(fakeTx({ touched: 0 }));
    expect(await duplicateChartRow({ sourceId, createdBy: null, dashboardId })).toEqual({ kind: "gone" });
    expect(untouched.chart.create).not.toHaveBeenCalled();
  });
});
