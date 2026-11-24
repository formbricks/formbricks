import { describe, expect, test } from "vitest";
import {
  MAX_DASHBOARD_WIDGETS,
  MAX_WIDGETS_PER_WRITE,
  ZDashboardFilterPicks,
  ZV3DashboardChartDataQuery,
  ZV3DashboardFilterValuesQuery,
  ZV3DashboardFilters,
  ZV3DashboardLayoutBody,
  ZV3DashboardReplaceBody,
  ZV3PageTeamIds,
  ZV3PageUpdateBody,
  ZV3WidgetCreateBody,
  ZV3WidgetLayoutInput,
  ZV3WidgetUpdateBody,
} from "./schemas";

const body = (widgets: { widgetId: string; order: number }[]) => ({
  name: "Board",
  expectedUpdatedAt: "2026-10-26T10:00:00.000Z",
  widgets: widgets.map((widget, index) => ({
    ...widget,
    // Four to a row, so even the largest write stays inside the grid's 1000 rows.
    layout: { x: (index % 4) * 3, y: Math.floor(index / 4) * 2, w: 3, h: 2 },
  })),
});

describe("ZV3DashboardReplaceBody", () => {
  test("takes back a stored order past the widget count, as adds and removals leave them", () => {
    // Adds take the highest order plus one and removals never renumber, so a long-lived dashboard holds these.
    const parsed = ZV3DashboardReplaceBody.safeParse(
      body([
        { widgetId: "clwg000000000000000000001", order: MAX_DASHBOARD_WIDGETS + 150 },
        { widgetId: "clwg000000000000000000002", order: 9_999 },
      ])
    );
    expect(parsed.success).toBe(true);
  });

  test("still refuses a negative, fractional or out-of-column order, and the old updatedAt name", () => {
    for (const order of [-1, 1.5, 2_147_483_648]) {
      expect(
        ZV3DashboardReplaceBody.safeParse(body([{ widgetId: "clwg000000000000000000001", order }])).success
      ).toBe(false);
    }
    const { expectedUpdatedAt, ...rest } = body([]);
    expect(ZV3DashboardReplaceBody.safeParse({ ...rest, updatedAt: expectedUpdatedAt }).success).toBe(false);
  });

  test("carries a dashboard that grew past the add cap before it existed, up to the request bound", () => {
    const widgets = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        widgetId: `clwg${String(index).padStart(21, "0")}`,
        order: index,
      }));

    expect(ZV3DashboardReplaceBody.safeParse(body(widgets(MAX_DASHBOARD_WIDGETS + 10))).success).toBe(true);
    expect(ZV3DashboardReplaceBody.safeParse(body(widgets(MAX_WIDGETS_PER_WRITE))).success).toBe(true);
    expect(ZV3DashboardReplaceBody.safeParse(body(widgets(MAX_WIDGETS_PER_WRITE + 1))).success).toBe(false);
  });
});

describe("dashboard filter picks (C6, C15)", () => {
  const A = "f1";

  test("one exported picks schema: a filter id to one to 100 values of up to 1000 characters", () => {
    expect(ZDashboardFilterPicks.safeParse({ [A]: ["Web", "App"] }).success).toBe(true);
    expect(ZDashboardFilterPicks.safeParse({ [A]: [] }).success).toBe(false);
    expect(ZDashboardFilterPicks.safeParse({ [A]: Array.from({ length: 101 }, () => "x") }).success).toBe(
      false
    );
    expect(ZDashboardFilterPicks.safeParse({ [A]: ["x".repeat(1001)] }).success).toBe(false);
    expect(ZDashboardFilterPicks.safeParse({ "not an id": ["x"] }).success).toBe(false);
  });

  test("refuses a NUL byte in a pick value and in a value-list search", () => {
    expect(ZDashboardFilterPicks.safeParse({ [A]: ["We\u0000b"] }).success).toBe(false);
    expect(ZV3DashboardChartDataQuery.safeParse({ [`picks[${A}]`]: "We\u0000b" }).success).toBe(false);
    expect(ZV3DashboardFilterValuesQuery.safeParse({ search: "a\u0000" }).success).toBe(false);
    expect(ZV3DashboardFilterValuesQuery.safeParse({ search: "web" }).success).toBe(true);
  });

  test("refuses a NUL byte in a filter label", () => {
    expect(
      ZV3DashboardFilters.safeParse([
        {
          id: "clfi000000000000000000001",
          field: "FeedbackRecords.sourceName",
          operator: "equals",
          label: "So\u0000urce",
        },
      ]).success
    ).toBe(false);
  });
});

const ID_1 = "clid000000000000000000001";
const ID_2 = "clid000000000000000000002";
const LAYOUT = { x: 0, y: 0, w: 3, h: 2 };
const TEXT = { headline: "Hello", description: "" };
const IMAGE = { fileUrl: null, fit: "fit", position: "center", alt: "" };

const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  (result.error?.issues ?? []).map((issue) => issue.path.map(String).join("."));

describe("ZV3WidgetLayoutInput", () => {
  test("takes a layout inside the grid", () => {
    expect(ZV3WidgetLayoutInput.safeParse({ x: 9, y: 0, w: 3, h: 1 }).success).toBe(true);
  });

  test("refuses a layout running past the last column, naming w", () => {
    const result = ZV3WidgetLayoutInput.safeParse({ x: 10, y: 0, w: 3, h: 1 });
    expect(issuePaths(result)).toEqual(["w"]);
  });
});

describe("page schemas", () => {
  test("takes no limit, an empty limit and distinct teams", () => {
    expect(ZV3PageTeamIds.safeParse(null).success).toBe(true);
    expect(ZV3PageTeamIds.safeParse([]).success).toBe(true);
    expect(ZV3PageTeamIds.safeParse([ID_1, ID_2]).success).toBe(true);
  });

  test("refuses a team listed twice, at its second position", () => {
    expect(issuePaths(ZV3PageTeamIds.safeParse([ID_1, ID_2, ID_1]))).toEqual(["2"]);
  });

  test("an update needs a name or teamIds", () => {
    expect(ZV3PageUpdateBody.safeParse({ name: " Page " }).data).toEqual({ name: "Page" });
    expect(ZV3PageUpdateBody.safeParse({ teamIds: null }).success).toBe(true);
    expect(ZV3PageUpdateBody.safeParse({}).success).toBe(false);
    expect(ZV3PageUpdateBody.safeParse({ name: "   " }).success).toBe(false);
  });
});

describe("ZV3WidgetCreateBody", () => {
  test("takes a chart, a text block, an image block and a separator", () => {
    expect(ZV3WidgetCreateBody.safeParse({ chartId: ID_1, layout: LAYOUT }).success).toBe(true);
    expect(ZV3WidgetCreateBody.safeParse({ kind: "text", content: TEXT }).success).toBe(true);
    expect(ZV3WidgetCreateBody.safeParse({ kind: "image", content: IMAGE }).success).toBe(true);
    expect(ZV3WidgetCreateBody.safeParse({ kind: "image" }).success).toBe(true);
    expect(ZV3WidgetCreateBody.safeParse({ kind: "separator", content: null }).success).toBe(true);
  });

  test("refuses a chart without its chartId, or with content", () => {
    expect(issuePaths(ZV3WidgetCreateBody.safeParse({}))).toEqual(["chartId"]);
    expect(issuePaths(ZV3WidgetCreateBody.safeParse({ chartId: ID_1, content: TEXT }))).toEqual(["content"]);
  });

  test("refuses a text block without content, and a block naming a chart", () => {
    expect(issuePaths(ZV3WidgetCreateBody.safeParse({ kind: "text" }))).toEqual(["content"]);
    expect(issuePaths(ZV3WidgetCreateBody.safeParse({ kind: "image", chartId: ID_1 }))).toEqual(["chartId"]);
  });

  test("refuses a separator with content", () => {
    expect(issuePaths(ZV3WidgetCreateBody.safeParse({ kind: "separator", content: TEXT }))).toEqual([
      "content",
    ]);
  });

  test("refuses block content of the wrong shape, naming the field", () => {
    expect(
      issuePaths(ZV3WidgetCreateBody.safeParse({ kind: "text", content: { headline: " ", description: "" } }))
    ).toEqual(["content"]);
    expect(
      issuePaths(ZV3WidgetCreateBody.safeParse({ kind: "image", content: { ...IMAGE, fit: "stretch" } }))
    ).toEqual(["content.fit"]);
  });

  test("refuses an argument it does not take", () => {
    expect(ZV3WidgetCreateBody.safeParse({ chartId: ID_1, extra: true }).success).toBe(false);
  });
});

describe("ZV3WidgetUpdateBody", () => {
  test("takes any one change and refuses none", () => {
    expect(ZV3WidgetUpdateBody.safeParse({ layout: LAYOUT }).success).toBe(true);
    expect(ZV3WidgetUpdateBody.safeParse({ pageId: ID_1 }).success).toBe(true);
    expect(ZV3WidgetUpdateBody.safeParse({ content: TEXT }).success).toBe(true);
    expect(ZV3WidgetUpdateBody.safeParse({}).success).toBe(false);
  });
});

describe("ZV3DashboardLayoutBody", () => {
  test("refuses a widget listed twice", () => {
    const result = ZV3DashboardLayoutBody.safeParse({
      expectedUpdatedAt: "2026-10-26T10:00:00.000Z",
      widgets: [
        { widgetId: ID_1, layout: LAYOUT },
        { widgetId: ID_1, layout: LAYOUT },
      ],
    });
    expect(issuePaths(result)).toEqual(["widgets.1"]);
  });
});

describe("ZV3DashboardReplaceBody pages and new widgets", () => {
  const replace = (extra: { pages?: unknown[]; widgets?: unknown[] }) => ({
    name: "Board",
    expectedUpdatedAt: "2026-10-26T10:00:00.000Z",
    widgets: [],
    ...extra,
  });
  const widget = (fields: Record<string, unknown>) => ({ layout: LAYOUT, order: 0, ...fields });

  test("takes existing and new pages with new widgets of each kind placed on them", () => {
    const result = ZV3DashboardReplaceBody.safeParse(
      replace({
        pages: [
          { pageId: ID_1, name: "One", order: 0 },
          { key: "new-page", name: "Two", order: 1, teamIds: [ID_2] },
        ],
        widgets: [
          widget({ widgetId: ID_1, pageKey: "new-page" }),
          widget({ kind: "chart", chartId: ID_2, pageId: ID_1 }),
          widget({ kind: "text", content: TEXT }),
          widget({ kind: "separator" }),
          widget({ widgetId: ID_2, kind: "image", content: IMAGE }),
        ],
      })
    );
    expect(result.success).toBe(true);
  });

  test("refuses a page sent with both or neither of pageId and key", () => {
    const result = ZV3DashboardReplaceBody.safeParse(
      replace({
        pages: [
          { pageId: ID_1, key: "k", name: "One", order: 0 },
          { name: "Two", order: 1 },
        ],
      })
    );
    expect(issuePaths(result)).toEqual(["pages.0", "pages.1"]);
  });

  test("refuses a page listed twice, existing or new", () => {
    const result = ZV3DashboardReplaceBody.safeParse(
      replace({
        pages: [
          { pageId: ID_1, name: "One", order: 0 },
          { pageId: ID_1, name: "One again", order: 1 },
          { key: "k", name: "New", order: 2 },
          { key: "k", name: "New again", order: 3 },
        ],
      })
    );
    expect(issuePaths(result)).toEqual(["pages.1", "pages.3"]);
  });

  test("refuses a widget naming both page fields, or a pageKey that is no new page", () => {
    const result = ZV3DashboardReplaceBody.safeParse(
      replace({
        pages: [{ key: "k", name: "New", order: 0 }],
        widgets: [
          widget({ widgetId: ID_1, pageId: ID_2, pageKey: "k" }),
          widget({ widgetId: ID_2, pageKey: "missing" }),
        ],
      })
    );
    expect(issuePaths(result)).toEqual(["widgets.0", "widgets.1.pageKey"]);
  });

  test("refuses repointing an existing widget's chart, and checks a kind it is sent with", () => {
    const result = ZV3DashboardReplaceBody.safeParse(
      replace({
        widgets: [
          widget({ widgetId: ID_1, chartId: ID_2 }),
          widget({ widgetId: ID_2, kind: "separator", content: TEXT }),
        ],
      })
    );
    expect(issuePaths(result)).toEqual(["widgets.0.chartId", "widgets.1.content"]);
  });

  test("refuses a new widget without a kind, a chart without chartId and a text block without content", () => {
    const result = ZV3DashboardReplaceBody.safeParse(
      replace({
        widgets: [widget({}), widget({ kind: "chart" }), widget({ kind: "text" })],
      })
    );
    expect(issuePaths(result)).toEqual(["widgets.0.kind", "widgets.1.chartId", "widgets.2.content"]);
  });
});
