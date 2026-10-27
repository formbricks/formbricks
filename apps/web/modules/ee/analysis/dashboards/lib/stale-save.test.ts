import { describe, expect, test } from "vitest";
import type { TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { draftOverLatest, toSavedWidgets, widgetsRemovedByOverwrite } from "./stale-save";

const widget = (id: string, x = 0): TDashboardWidget =>
  ({
    id,
    chartId: `chart_${id}`,
    dashboardId: "d",
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

  test("sends widgets in the order they are listed", () => {
    expect(toSavedWidgets([widget("c", 8), widget("a", 4)])).toEqual([
      { widgetId: "c", layout: { x: 8, y: 0, w: 4, h: 4 }, order: 0 },
      { widgetId: "a", layout: { x: 4, y: 0, w: 4, h: 4 }, order: 1 },
    ]);
  });
});
