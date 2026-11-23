import { describe, expect, test } from "vitest";
import type { TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import {
  draftOverLatest,
  draftPagesOverLatest,
  toSavedWidgets,
  widgetsRemovedByOverwrite,
} from "./stale-save";

const widget = (id: string, x = 0): TDashboardWidget =>
  ({
    id,
    chartId: `chart_${id}`,
    dashboardId: "d",
    pageId: "p1",
    kind: "chart",
    layout: { x, y: 0, w: 4, h: 4 },
    order: 0,
  }) as TDashboardWidget;

describe("stale dashboard save", () => {
  test("warns about exactly the widgets added since the edit began", () => {
    const base = new Set(["a", "b"]);
    const latest = [widget("a"), widget("b"), widget("added")];
    const draft = [widget("b", 4), widget("a", 8)];
    expect(widgetsRemovedByOverwrite(latest, draft, base).map((w) => w.id)).toEqual(["added"]);
    expect(widgetsRemovedByOverwrite(draft, draft, base)).toEqual([]);
  });

  test("does not warn about a widget the editor removed itself", () => {
    const base = new Set(["kept", "removed"]);
    const latest = [widget("kept"), widget("removed"), widget("added")];
    const draft = [widget("kept")];
    expect(widgetsRemovedByOverwrite(latest, draft, base).map((w) => w.id)).toEqual(["added"]);
  });

  test("drops a widget someone else removed meanwhile, keeping the editor's places and order", () => {
    const latest = [widget("a"), widget("c")];
    const draft = [widget("c", 8), widget("gone"), widget("a", 4)];
    expect(draftOverLatest(latest, draft)).toEqual([widget("c", 8), widget("a", 4)]);
  });

  test("keeps widgets the editor added, and drops those on a page that is gone", () => {
    const latest = [widget("a")];
    const added = { ...widget("draft-1"), pageId: "p1" };
    const onGonePage = { ...widget("a"), pageId: "p_gone" };
    expect(
      draftOverLatest(latest, [added, onGonePage], [{ id: "p1", name: "P", order: 0, teamIds: [] }])
    ).toEqual([added]);
  });

  test("keeps the editor's pages that still exist and the ones they added", () => {
    const latest = [{ id: "p1", name: "P1", order: 0, teamIds: [] }];
    const draft = [
      { id: "p_gone", name: "Gone", order: 0, teamIds: [] },
      { id: "p1", name: "Renamed", order: 1, teamIds: [] },
      { id: "draft-2", name: "New", order: 2, teamIds: [] },
    ];
    expect(draftPagesOverLatest(latest, draft).map((page) => page.id)).toEqual(["p1", "draft-2"]);
    expect(draftPagesOverLatest(latest, [draft[0]])).toBe(latest);
  });

  test("sends widgets in the order they are listed", () => {
    expect(toSavedWidgets([widget("c", 8), widget("a", 4)])).toEqual([
      { widgetId: "c", pageId: "p1", layout: { x: 8, y: 0, w: 4, h: 4 }, order: 0 },
      { widgetId: "a", pageId: "p1", layout: { x: 4, y: 0, w: 4, h: 4 }, order: 1 },
    ]);
  });
});
