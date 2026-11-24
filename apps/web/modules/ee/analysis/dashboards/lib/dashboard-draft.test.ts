import { describe, expect, test } from "vitest";
import type { TChart, TDashboardPage, TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import {
  addDraftBlock,
  addDraftCharts,
  addDraftPage,
  deleteDraftPage,
  findEmptyTextBlocks,
  isDraftId,
  moveDraftPage,
  pagesChanged,
  renameDraftPage,
  resolveSelectedPageId,
  setDraftPageTeams,
  toSavedPages,
  toSavedWidgets,
  widgetsChanged,
} from "./dashboard-draft";

const page = (id: string, order: number, teamIds: string[] = []): TDashboardPage => ({
  id,
  name: `Page ${id}`,
  order,
  teamIds,
});

const chartWidget = (id: string, pageId: string, chartId: string, x = 0): TDashboardWidget => ({
  id,
  dashboardId: "d",
  pageId,
  kind: "chart",
  chartId,
  chart: { id: chartId, type: "bar" } as TChart,
  content: null,
  layout: { x, y: 0, w: 4, h: 4 },
  order: 0,
});

const pages = [page("p1", 0), page("p2", 1, ["t1"])];

describe("pages in the draft", () => {
  test("resolves the selected page from the URL, falling back to the first", () => {
    expect(resolveSelectedPageId(pages, "p2")).toBe("p2");
    expect(resolveSelectedPageId(pages, "gone")).toBe("p1");
    expect(resolveSelectedPageId(pages, null)).toBe("p1");
    expect(resolveSelectedPageId([], null)).toBeNull();
  });

  test("adds a page last, open to all teams, with a draft id", () => {
    const { pages: next, pageId } = addDraftPage(pages, "Notes");
    expect(isDraftId(pageId)).toBe(true);
    expect(next.at(-1)).toEqual({ id: pageId, name: "Notes", order: 2, teamIds: [] });
  });

  test("renames and limits one page", () => {
    expect(renameDraftPage(pages, "p1", "Summary")[0].name).toBe("Summary");
    expect(setDraftPageTeams(pages, "p2", [])[1].teamIds).toEqual([]);
  });

  test("moves a page where another was, renumbering the order", () => {
    const moved = moveDraftPage([...pages, page("p3", 2)], "p3", "p1");
    expect(moved.map(({ id, order }) => [id, order])).toEqual([
      ["p3", 0],
      ["p1", 1],
      ["p2", 2],
    ]);
    expect(moveDraftPage(pages, "p1", "missing")).toBe(pages);
  });

  test("deletes a page with its widgets, but never the last page", () => {
    const widgets = [chartWidget("w1", "p1", "c1"), chartWidget("w2", "p2", "c2")];
    const next = deleteDraftPage(pages, widgets, "p1");
    expect(next.pages).toEqual([{ ...pages[1], order: 0 }]);
    expect(next.widgets.map((widget) => widget.id)).toEqual(["w2"]);
    expect(deleteDraftPage(next.pages, next.widgets, "p2")).toEqual(next);
  });

  test("notices an added, renamed, reordered or re-limited page", () => {
    expect(pagesChanged(pages, pages)).toBe(false);
    expect(pagesChanged(renameDraftPage(pages, "p1", "x"), pages)).toBe(true);
    expect(pagesChanged(moveDraftPage(pages, "p2", "p1"), pages)).toBe(true);
    expect(pagesChanged(setDraftPageTeams(pages, "p1", ["t9"]), pages)).toBe(true);
    expect(pagesChanged(addDraftPage(pages, "x").pages, pages)).toBe(true);
  });

  test("sends existing pages by id, new ones by key, and a team limit only where it changed", () => {
    const { pages: withNew, pageId } = addDraftPage(setDraftPageTeams(pages, "p1", ["t1"]), " Notes ");
    expect(toSavedPages(withNew, pages)).toEqual([
      { pageId: "p1", name: "Page p1", order: 0, teamIds: ["t1"] },
      { pageId: "p2", name: "Page p2", order: 1 },
      { key: pageId, name: "Notes", order: 2 },
    ]);
  });
});

describe("widgets in the draft", () => {
  test("drops a block on the page in its next free slot", () => {
    const widgets = [chartWidget("w1", "p1", "c1")];
    const { widgets: next, widgetId } = addDraftBlock(widgets, {
      kind: "text",
      pageId: "p1",
      dashboardId: "d",
    });
    const added = next.find((widget) => widget.id === widgetId);
    expect(added).toMatchObject({ kind: "text", pageId: "p1", content: { headline: "", description: "" } });
    // Nine columns do not fit beside the four-wide chart, so the block opens a row below it.
    expect(added?.layout).toEqual({ x: 0, y: 4, w: 9, h: 8 });
  });

  test("places picked charts on the page, skipping one already there, and allowing it on another page", () => {
    const widgets = [chartWidget("w1", "p1", "c1")];
    const charts = [{ id: "c1", type: "bar" } as TChart, { id: "c2", type: "big_number" } as TChart];
    const onP1 = addDraftCharts(widgets, { charts, pageId: "p1", dashboardId: "d" });
    expect(onP1.map((widget) => widget.chartId)).toEqual(["c1", "c2"]);
    expect(onP1[1].layout).toEqual({ x: 4, y: 0, w: 3, h: 8 });
    const onP2 = addDraftCharts(widgets, { charts, pageId: "p2", dashboardId: "d" });
    expect(onP2.filter((widget) => widget.pageId === "p2").map((widget) => widget.chartId)).toEqual([
      "c1",
      "c2",
    ]);
  });

  test("finds text blocks with neither a headline nor a description", () => {
    const { widgets } = addDraftBlock([], { kind: "text", pageId: "p1", dashboardId: "d" });
    expect(findEmptyTextBlocks(widgets)).toHaveLength(1);
    const filled = widgets.map((widget) =>
      widget.kind === "text" ? { ...widget, content: { headline: "Hi", description: "" } } : widget
    );
    expect(findEmptyTextBlocks(filled)).toHaveLength(0);
  });

  test("notices a widget moved to another page or with new content", () => {
    const widgets = [chartWidget("w1", "p1", "c1")];
    expect(widgetsChanged(widgets, widgets)).toBe(false);
    expect(widgetsChanged([{ ...widgets[0], pageId: "p2" }], widgets)).toBe(true);
  });

  test("sends existing widgets by id with their page, and new ones by kind", () => {
    const { pageId } = addDraftPage(pages, "New");
    const existing = chartWidget("w1", "p1", "c1");
    const { widgets } = addDraftBlock([existing], { kind: "separator", pageId, dashboardId: "d" });
    const withChart = addDraftCharts(widgets, {
      charts: [{ id: "c9", type: "bar" } as TChart],
      pageId: "p2",
      dashboardId: "d",
    });
    expect(toSavedWidgets(withChart)).toEqual([
      { widgetId: "w1", pageId: "p1", layout: existing.layout, order: 0 },
      { kind: "separator", pageKey: pageId, layout: { x: 0, y: 0, w: 12, h: 2 }, order: 1 },
      { kind: "chart", chartId: "c9", pageId: "p2", layout: { x: 0, y: 0, w: 4, h: 16 }, order: 2 },
    ]);
  });
});
