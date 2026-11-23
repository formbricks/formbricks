import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { replaceDashboardRow } from "./replace-service";
import { planNewWidget } from "./widget-service";

/**
 * The whole-dashboard write's decisions inside its transaction: the version check, which pages and
 * widgets it keeps, creates and removes, the per-page rules (a chart once per page, no overlaps), block
 * content, the page team-limit gate, and that a refused write writes nothing. The transaction client is a
 * stub; the real-database behaviour lives in `replace-operations.integration.test.ts`.
 */

vi.mock("server-only", () => ({}));

const { mockTransaction } = vi.hoisted(() => ({ mockTransaction: vi.fn() }));

vi.mock("@formbricks/database", () => ({ prisma: { $transaction: mockTransaction } }));

const DASHBOARD_ID = "cldb000000000000000000001";
const WORKSPACE_ID = "clws000000000000000000001";
const PAGE_1 = "clpg000000000000000000001";
const PAGE_2 = "clpg000000000000000000002";
const LOCKED_AT = new Date("2026-06-01T12:00:00.000Z");

const widgetA = {
  id: "clwg_a",
  pageId: PAGE_1,
  kind: "chart" as const,
  chartId: "clch_a",
  layout: { x: 0, y: 0, w: 4, h: 4 },
  order: 0,
};
const widgetB = {
  id: "clwg_b",
  pageId: PAGE_1,
  kind: "chart" as const,
  chartId: "clch_b",
  layout: { x: 4, y: 0, w: 4, h: 4 },
  order: 1,
};
const textOnPage2 = {
  id: "clwg_t",
  pageId: PAGE_2,
  kind: "text" as const,
  chartId: null,
  layout: { x: 0, y: 0, w: 9, h: 2 },
  order: 2,
};

const stored = {
  name: "Board",
  updatedAt: LOCKED_AT,
  filters: [],
  pages: [
    { id: PAGE_1, name: "Overview", order: 0, teamLimits: [] as { teamId: string }[] },
    { id: PAGE_2, name: "Details", order: 1, teamLimits: [{ teamId: "clteam_a" }] },
  ],
  widgets: [widgetA, widgetB, textOnPage2],
};

const makeTx = ({
  locked = LOCKED_AT,
  found = stored,
  charts = [],
  teams = [],
}: {
  locked?: Date | null;
  found?: typeof stored | null;
  charts?: { id: string }[];
  teams?: { id: string }[];
} = {}) => {
  let created = 0;
  return {
    $queryRaw: vi.fn(async () => (locked ? [{ updatedAt: locked }] : [])),
    $executeRaw: vi.fn(async () => 1),
    dashboard: {
      findUnique: vi.fn(async () => found),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: DASHBOARD_ID, ...data })),
    },
    dashboardPage: {
      create: vi.fn(async () => ({ id: `clpg_new_${(created += 1).toString()}` })),
      update: vi.fn(async () => ({ id: "x" })),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    dashboardPageTeam: {
      deleteMany: vi.fn(async () => ({ count: 1 })),
      createMany: vi.fn(async () => ({ count: 1 })),
    },
    dashboardWidget: {
      deleteMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(async () => ({ id: "x" })),
      createMany: vi.fn(async () => ({ count: 1 })),
    },
    chart: { findMany: vi.fn(async () => charts) },
    team: { findMany: vi.fn(async () => teams) },
  };
};

type TTx = ReturnType<typeof makeTx>;

const stub = (tx: TTx) => {
  mockTransaction.mockImplementation(async (callback: (client: TTx) => unknown) => callback(tx));
  return tx;
};

const expectNothingWritten = (tx: TTx) => {
  expect(tx.dashboard.update).not.toHaveBeenCalled();
  expect(tx.dashboardPage.create).not.toHaveBeenCalled();
  expect(tx.dashboardPage.update).not.toHaveBeenCalled();
  expect(tx.dashboardPage.deleteMany).not.toHaveBeenCalled();
  expect(tx.dashboardWidget.deleteMany).not.toHaveBeenCalled();
  expect(tx.dashboardWidget.createMany).not.toHaveBeenCalled();
  expect(tx.$executeRaw).not.toHaveBeenCalled();
};

/** The widget places a save wrote in its one UPDATE: ids, pages, layouts and orders, in order. */
const placesWritten = (tx: TTx) => {
  expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  const [strings, ids, pageIds, layouts, orders, dashboardId] = tx.$executeRaw.mock.calls[0] as unknown as [
    TemplateStringsArray,
    string[],
    string[],
    string[],
    (number | null)[],
    string,
  ];
  expect(strings.join("?")).toContain('w."dashboardId" = ?');
  return {
    ids,
    pageIds,
    layouts: layouts.map((layout) => JSON.parse(layout) as unknown),
    orders,
    dashboardId,
  };
};

const replace = (input: Partial<Parameters<typeof replaceDashboardRow>[0]> = {}) =>
  replaceDashboardRow({
    dashboardId: DASHBOARD_ID,
    workspaceId: WORKSPACE_ID,
    expectedUpdatedAt: LOCKED_AT,
    ...input,
  });

const keepAll = [
  { widgetId: widgetA.id, layout: widgetA.layout },
  { widgetId: widgetB.id, layout: widgetB.layout },
  { widgetId: textOnPage2.id, layout: textOnPage2.layout },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: LOCKED_AT, toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("replaceDashboardRow: the version and the widgets", () => {
  test("is gone when the dashboard cannot be locked", async () => {
    const tx = stub(makeTx({ locked: null }));
    expect(await replace({ widgets: [] })).toEqual({ kind: "gone" });
    expect(tx.dashboard.findUnique).not.toHaveBeenCalled();
  });

  test("refuses a stale version, naming the current one, and writes nothing", async () => {
    const tx = stub(makeTx());
    expect(await replace({ expectedUpdatedAt: new Date(LOCKED_AT.getTime() - 1), widgets: [] })).toEqual({
      kind: "stale",
      currentUpdatedAt: LOCKED_AT,
    });
    expectNothingWritten(tx);
  });

  test("refuses widgets that are not on the dashboard, naming them", async () => {
    const tx = stub(makeTx());
    expect(
      await replace({
        widgets: [...keepAll, { widgetId: "clwg_foreign", layout: { x: 0, y: 8, w: 4, h: 4 } }],
      })
    ).toEqual({ kind: "unknownWidgets", widgetIds: ["clwg_foreign"] });
    expectNothingWritten(tx);
  });

  test("with requireEveryWidget, refuses a list that leaves a widget out, and removes nothing", async () => {
    const tx = stub(makeTx());
    expect(await replace({ widgets: keepAll.slice(0, 2), requireEveryWidget: true })).toEqual({
      kind: "missingWidgets",
      widgetIds: [textOnPage2.id],
    });
    expectNothingWritten(tx);
  });

  test("refuses widgets overlapping on one page, naming both", async () => {
    const tx = stub(makeTx());
    expect(
      await replace({
        widgets: [
          { widgetId: widgetA.id, layout: { x: 0, y: 0, w: 6, h: 4 } },
          { widgetId: widgetB.id, layout: { x: 5, y: 0, w: 4, h: 4 } },
          keepAll[2],
        ],
      })
    ).toEqual({ kind: "overlap", widgetIds: [widgetB.id, widgetA.id] });
    expectNothingWritten(tx);
  });

  test("lets widgets on different pages share grid cells", async () => {
    stub(makeTx());
    expect(
      (
        await replace({
          widgets: [
            { widgetId: widgetA.id, layout: { x: 0, y: 0, w: 9, h: 2 } },
            { widgetId: widgetB.id, layout: { x: 9, y: 0, w: 3, h: 2 } },
            { widgetId: textOnPage2.id, layout: { x: 0, y: 0, w: 9, h: 2 } },
          ],
        })
      ).kind
    ).toBe("ok");
  });

  test("refuses a chart sent twice on one page, but takes it on two pages", async () => {
    let tx = stub(makeTx({ charts: [{ id: widgetA.chartId }] }));
    expect(
      await replace({
        widgets: [
          ...keepAll,
          { kind: "chart", chartId: widgetA.chartId, pageId: PAGE_1, layout: { x: 0, y: 4, w: 4, h: 4 } },
        ],
      })
    ).toEqual({ kind: "duplicateChart", chartId: widgetA.chartId });
    expectNothingWritten(tx);

    tx = stub(makeTx({ charts: [{ id: widgetA.chartId }] }));
    expect(
      (
        await replace({
          widgets: [
            ...keepAll,
            { kind: "chart", chartId: widgetA.chartId, pageId: PAGE_2, layout: { x: 0, y: 4, w: 4, h: 4 } },
          ],
        })
      ).kind
    ).toBe("ok");
    expect(tx.dashboardWidget.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          pageId: PAGE_2,
          kind: "chart",
          chartId: widgetA.chartId,
          content: Prisma.DbNull,
        }),
      ],
    });
  });

  test("refuses a new chart widget whose chart is not in the dashboard's workspace", async () => {
    const tx = stub(makeTx({ charts: [] }));
    expect(
      await replace({
        widgets: [
          ...keepAll,
          { kind: "chart", chartId: "clch_elsewhere", layout: { x: 0, y: 4, w: 4, h: 4 } },
        ],
      })
    ).toEqual({ kind: "invalidWidget", index: 3, name: "chartId", reason: "Not a chart of this workspace." });
    expect(tx.chart.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["clch_elsewhere"] }, workspaceId: WORKSPACE_ID } })
    );
    expectNothingWritten(tx);
  });

  test("refuses an empty text block, a foreign image file, and a kind that is not the stored one", async () => {
    stub(makeTx());
    expect(
      await replace({
        widgets: [
          ...keepAll,
          { kind: "text", content: { headline: " ", description: "" }, layout: { x: 0, y: 4, w: 9, h: 2 } },
        ],
      })
    ).toMatchObject({ kind: "invalidWidget", index: 3, name: "content" });

    stub(makeTx());
    expect(
      await replace({
        widgets: [
          ...keepAll,
          {
            kind: "image",
            content: {
              fileUrl: "/storage/clws_other/private/dashboards/cldb1/x.png",
              fit: "fit",
              position: "left",
              alt: "",
            },
            layout: { x: 0, y: 4, w: 3, h: 3 },
          },
        ],
      })
    ).toMatchObject({ kind: "invalidWidget", index: 3, name: "content" });

    stub(makeTx());
    expect(
      await replace({ widgets: [{ ...keepAll[0], kind: "image" }, keepAll[1], keepAll[2]] })
    ).toMatchObject({ kind: "invalidWidget", index: 0, name: "kind" });
  });

  test("saves name and places, removes an omitted widget, and moves updatedAt past the locked value", async () => {
    const tx = stub(makeTx());
    const moved = { x: 0, y: 4, w: 6, h: 4 };
    const result = await replace({
      name: "Renamed",
      widgets: [{ widgetId: widgetA.id, layout: moved, order: 5 }, keepAll[2]],
    });

    expect(result).toMatchObject({ kind: "ok", previous: { name: "Board" } });
    expect(tx.dashboardWidget.deleteMany).toHaveBeenCalledWith({
      where: { dashboardId: DASHBOARD_ID, id: { in: [widgetB.id] } },
    });
    expect(placesWritten(tx)).toEqual({
      ids: [widgetA.id, textOnPage2.id],
      pageIds: [PAGE_1, PAGE_2],
      layouts: [moved, textOnPage2.layout],
      orders: [5, null],
      dashboardId: DASHBOARD_ID,
    });
    expect(tx.dashboard.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: "Renamed", updatedAt: new Date(LOCKED_AT.getTime() + 1) } })
    );
  });

  test("replaces a block's content when sent, and keeps it when not", async () => {
    const tx = stub(makeTx());
    await replace({
      widgets: [
        keepAll[0],
        keepAll[1],
        { ...keepAll[2], content: { headline: "Hello", description: "World" } },
      ],
    });
    expect(tx.dashboardWidget.update).toHaveBeenCalledTimes(1);
    expect(tx.dashboardWidget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: textOnPage2.id },
        data: { content: { headline: "Hello", description: "World" } },
      })
    );
  });
});

describe("replaceDashboardRow: pages", () => {
  const pagesAsStored = [
    { pageId: PAGE_1, name: "Overview", order: 0 },
    { pageId: PAGE_2, name: "Details", order: 1 },
  ];

  test("refuses a page that is not one of the dashboard's", async () => {
    const tx = stub(makeTx());
    expect(
      await replace({
        pages: [...pagesAsStored, { pageId: "clpg_foreign", name: "X", order: 2 }],
        widgets: keepAll,
      })
    ).toEqual({ kind: "unknownPages", pageIds: ["clpg_foreign"] });
    expectNothingWritten(tx);
  });

  test("creates a new page and puts a new block on it by its key", async () => {
    const tx = stub(makeTx());
    const result = await replace({
      pages: [...pagesAsStored, { key: "draft-1", name: "Notes", order: 2 }],
      widgets: [...keepAll, { kind: "separator", pageKey: "draft-1", layout: { x: 0, y: 0, w: 12, h: 1 } }],
    });
    expect(result.kind).toBe("ok");
    expect(tx.dashboardPage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { dashboardId: DASHBOARD_ID, name: "Notes", order: 2, teamLimits: { create: [] } },
      })
    );
    expect(tx.dashboardWidget.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ pageId: "clpg_new_1", kind: "separator", chartId: null })],
    });
  });

  test("renames and reorders kept pages, and deletes a page left out after moving widgets off it", async () => {
    const tx = stub(makeTx());
    const result = await replace({
      pages: [{ pageId: PAGE_1, name: "Summary", order: 0 }],
      widgets: [
        keepAll[0],
        keepAll[1],
        { ...keepAll[2], pageId: PAGE_1, layout: { x: 0, y: 4, w: 9, h: 2 } },
      ],
    });
    expect(result.kind).toBe("ok");
    expect(tx.dashboardPage.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PAGE_1 }, data: { name: "Summary", order: 0 } })
    );
    expect(placesWritten(tx).pageIds).toEqual([PAGE_1, PAGE_1, PAGE_1]);
    expect(tx.dashboardPage.deleteMany).toHaveBeenCalledWith({
      where: { dashboardId: DASHBOARD_ID, id: { in: [PAGE_2] } },
    });
    // The page delete comes after the widgets moved off it, or it would take them along.
    expect(tx.dashboardPage.deleteMany.mock.invocationCallOrder[0]).toBeGreaterThan(
      tx.$executeRaw.mock.invocationCallOrder[0]
    );
  });

  test("refuses a widget left on a page the save removes", async () => {
    const tx = stub(makeTx());
    expect(await replace({ pages: [pagesAsStored[0]], widgets: keepAll })).toMatchObject({
      kind: "invalidWidget",
      index: 2,
      name: "pageId",
    });
    expectNothingWritten(tx);
  });

  test("a team limit sent back unchanged needs no permission", async () => {
    const tx = stub(makeTx());
    const result = await replace({
      pages: [pagesAsStored[0], { ...pagesAsStored[1], teamIds: ["clteam_a"] }],
      widgets: keepAll,
    });
    expect(result.kind).toBe("ok");
    expect(tx.dashboardPageTeam.deleteMany).not.toHaveBeenCalled();
    expect(tx.team.findMany).not.toHaveBeenCalled();
  });

  test("refuses a team limit change from someone who may not manage access, and writes nothing", async () => {
    const tx = stub(makeTx());
    expect(
      await replace({ pages: [pagesAsStored[0], { ...pagesAsStored[1], teamIds: [] }], widgets: keepAll })
    ).toEqual({ kind: "accessDenied" });
    expectNothingWritten(tx);
  });

  test("refuses a team a page cannot be limited to", async () => {
    const tx = stub(makeTx({ teams: [] }));
    expect(
      await replace({
        pages: [{ ...pagesAsStored[0], teamIds: ["clteam_b"] }, pagesAsStored[1]],
        widgets: keepAll,
        canManageAccess: true,
      })
    ).toEqual({ kind: "ineligibleTeams", teamIds: ["clteam_b"] });
    expectNothingWritten(tx);
  });

  test("replaces a changed team limit for someone who may manage access", async () => {
    const tx = stub(makeTx({ teams: [{ id: "clteam_b" }] }));
    const result = await replace({
      pages: [
        { ...pagesAsStored[0], teamIds: ["clteam_b"] },
        { ...pagesAsStored[1], teamIds: null },
      ],
      widgets: keepAll,
      canManageAccess: true,
    });
    expect(result.kind).toBe("ok");
    expect(tx.dashboardPageTeam.createMany).toHaveBeenCalledWith({
      data: [{ pageId: PAGE_1, teamId: "clteam_b" }],
    });
    expect(tx.dashboardPageTeam.deleteMany).toHaveBeenCalledWith({ where: { pageId: PAGE_2 } });
  });
});

describe("planNewWidget", () => {
  const size = { x: 0, y: 0, w: 4, h: 4 };

  test("places a new widget in the first open slot while the grid has room", () => {
    expect(planNewWidget({ siblings: [], widgetCount: 0, size })).toEqual({
      kind: "ok",
      layout: { x: 0, y: 0, w: 4, h: 4 },
      order: 0,
    });
  });

  test("refuses a slot below the grid's last row, which a whole-dashboard save could not carry", () => {
    const siblings = Array.from({ length: 126 }, (_, index) => ({
      id: `widget-${index.toString()}`,
      layout: { x: 0, y: index * 8, w: 12, h: 8 },
      order: index,
    }));
    expect(planNewWidget({ siblings, widgetCount: 126, size })).toEqual({ kind: "noSpace" });
  });
});
