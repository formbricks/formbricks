import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import {
  createChartRow,
  deleteChartRow,
  getChartResourceRow,
  listChartResourceRows,
  selectChartResource,
  updateChartRow,
} from "./service";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    chart: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const chartId = "clch000000000000000000001";
const workspaceId = "clws000000000000000000001";
const datasetId = "clds000000000000000000001";

/** The transaction client `deleteChartRow` runs against: a lock result and the chart's widgets. */
const fakeTx = ({ locked, widgets }: { locked: { id: string }[]; widgets: unknown[] }) => ({
  $queryRaw: vi.fn().mockResolvedValue(locked),
  dashboardWidget: { findMany: vi.fn().mockResolvedValue(widgets) },
  chart: { delete: vi.fn().mockResolvedValue({ id: chartId }) },
});

const runTransactionWith = (tx: ReturnType<typeof fakeTx>) => {
  vi.mocked(prisma.$transaction).mockImplementation((async (run: (client: typeof tx) => unknown) =>
    run(tx)) as never);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("chart reads", () => {
  test("reads one chart by id with the resource select", async () => {
    await getChartResourceRow(chartId);

    expect(prisma.chart.findUnique).toHaveBeenCalledWith({
      where: { id: chartId },
      select: selectChartResource,
    });
  });

  test("lists only the workspace's charts, newest first, one row past the page", async () => {
    await listChartResourceRows({ filter: { workspaceId }, cursor: null, limit: 20 });

    expect(prisma.chart.findMany).toHaveBeenCalledWith({
      where: { workspaceId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 21,
      select: selectChartResource,
    });
  });

  test("adds the name filter with LIKE wildcards escaped, the dataset filter, and the keyset condition", async () => {
    await listChartResourceRows({
      filter: { workspaceId, nameContains: "50%_done", datasetId },
      cursor: { value: "2026-02-01T00:00:00.000Z", id: "clch000000000000000000002" },
      limit: 5,
    });

    const after = new Date("2026-02-01T00:00:00.000Z");
    expect(vi.mocked(prisma.chart.findMany).mock.calls[0][0]?.where).toEqual({
      workspaceId,
      name: { contains: String.raw`50\%\_done`, mode: "insensitive" },
      feedbackDirectoryId: datasetId,
      OR: [{ createdAt: { lt: after } }, { createdAt: after, id: { lt: "clch000000000000000000002" } }],
    });
  });
});

describe("chart writes", () => {
  test("creates a chart in the given workspace on its Feedback Dataset", async () => {
    await createChartRow({
      name: "NPS",
      type: "bar",
      query: { measures: ["FeedbackRecords.count"] },
      config: {},
      workspaceId,
      datasetId,
      createdBy: "user_1",
    });

    expect(prisma.chart.create).toHaveBeenCalledWith({
      data: {
        name: "NPS",
        type: "bar",
        query: { measures: ["FeedbackRecords.count"] },
        config: {},
        workspaceId,
        feedbackDirectoryId: datasetId,
        createdBy: "user_1",
      },
      select: selectChartResource,
    });
  });

  test("updates only the chart named, with only the fields given", async () => {
    await updateChartRow(chartId, { name: "Renamed" });

    expect(prisma.chart.update).toHaveBeenCalledWith({
      where: { id: chartId },
      data: { name: "Renamed" },
      select: selectChartResource,
    });
  });
});

describe("deleteChartRow", () => {
  test("locks the chart row before anything else", async () => {
    const tx = fakeTx({ locked: [{ id: chartId }], widgets: [] });
    runTransactionWith(tx);

    await deleteChartRow(chartId);

    const [strings, ...values] = tx.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(strings.join("?")).toMatch(/FROM "Chart" WHERE id = \? FOR UPDATE/);
    expect(values).toEqual([chartId]);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.dashboardWidget.findMany.mock.invocationCallOrder[0]
    );
  });

  test("deletes a chart on no dashboard", async () => {
    const tx = fakeTx({ locked: [{ id: chartId }], widgets: [] });
    runTransactionWith(tx);

    expect(await deleteChartRow(chartId)).toEqual({ kind: "deleted" });
    expect(tx.dashboardWidget.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { chartId } }));
    expect(tx.chart.delete).toHaveBeenCalledWith({ where: { id: chartId } });
  });

  test("keeps a chart that is on dashboards and names them", async () => {
    const tx = fakeTx({
      locked: [{ id: chartId }],
      widgets: [
        { dashboard: { id: "cldb000000000000000000001", name: "Alpha" } },
        { dashboard: { id: "cldb000000000000000000002", name: "Beta" } },
      ],
    });
    runTransactionWith(tx);

    expect(await deleteChartRow(chartId)).toEqual({
      kind: "inUse",
      dashboards: [
        { id: "cldb000000000000000000001", name: "Alpha" },
        { id: "cldb000000000000000000002", name: "Beta" },
      ],
    });
    expect(tx.chart.delete).not.toHaveBeenCalled();
  });

  test("reports a chart deleted meanwhile as gone, without reading widgets or deleting", async () => {
    const tx = fakeTx({ locked: [], widgets: [] });
    runTransactionWith(tx);

    expect(await deleteChartRow(chartId)).toEqual({ kind: "gone" });
    expect(tx.dashboardWidget.findMany).not.toHaveBeenCalled();
    expect(tx.chart.delete).not.toHaveBeenCalled();
  });

  test("runs the transaction again after a deadlock", async () => {
    const tx = fakeTx({ locked: [{ id: chartId }], widgets: [] });
    vi.mocked(prisma.$transaction)
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("deadlock", { code: "P2034", clientVersion: "7" })
      )
      .mockImplementationOnce((async (run: (client: typeof tx) => unknown) => run(tx)) as never);

    expect(await deleteChartRow(chartId)).toEqual({ kind: "deleted" });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
