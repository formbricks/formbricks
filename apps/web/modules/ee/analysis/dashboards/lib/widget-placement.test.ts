import { describe, expect, test } from "vitest";
import { GRID_COLUMNS, findNextOpenSlot, parseWidgetLayouts } from "./widget-placement";

describe("findNextOpenSlot", () => {
  test("places the first widget at the origin", () => {
    expect(findNextOpenSlot([], { w: 4, h: 4 })).toEqual({ x: 0, y: 0 });
  });

  test("fills the gap next to a single widget instead of stacking below it", () => {
    expect(findNextOpenSlot([{ x: 0, y: 0, w: 4, h: 4 }], { w: 4, h: 4 })).toEqual({ x: 4, y: 0 });
  });

  test("skips a partly filled row and finds the hole further along it", () => {
    const existing = [
      { x: 0, y: 0, w: 4, h: 4 },
      { x: 8, y: 0, w: 4, h: 4 },
    ];

    expect(findNextOpenSlot(existing, { w: 4, h: 4 })).toEqual({ x: 4, y: 0 });
  });

  test("starts a new row when the current one leaves no wide enough gap", () => {
    const existing = [
      { x: 0, y: 0, w: 6, h: 4 },
      { x: 6, y: 0, w: 4, h: 4 },
    ];

    // Only 2 columns are left on row 0, so a 4-wide widget has to go below.
    expect(findNextOpenSlot(existing, { w: 4, h: 4 })).toEqual({ x: 0, y: 4 });
  });

  test("uses a narrow leftover gap when the widget is small enough for it", () => {
    const existing = [
      { x: 0, y: 0, w: 6, h: 4 },
      { x: 6, y: 0, w: 4, h: 4 },
    ];

    expect(findNextOpenSlot(existing, { w: 2, h: 2 })).toEqual({ x: 10, y: 0 });
  });

  test("finds a gap left by a shorter widget above", () => {
    const existing = [
      { x: 0, y: 0, w: 12, h: 2 },
      { x: 0, y: 2, w: 8, h: 4 },
    ];

    expect(findNextOpenSlot(existing, { w: 4, h: 4 })).toEqual({ x: 8, y: 2 });
  });

  test("appends below everything when the grid is full", () => {
    const existing = [{ x: 0, y: 0, w: 12, h: 4 }];

    expect(findNextOpenSlot(existing, { w: 4, h: 4 })).toEqual({ x: 0, y: 4 });
  });

  test("clamps a widget wider than the grid instead of never fitting it", () => {
    expect(findNextOpenSlot([{ x: 0, y: 0, w: 12, h: 3 }], { w: 14, h: 3 })).toEqual({ x: 0, y: 3 });
  });

  test("honours a narrower breakpoint", () => {
    expect(findNextOpenSlot([{ x: 0, y: 0, w: 4, h: 4 }], { w: 4, h: 4 }, 6)).toEqual({ x: 0, y: 4 });
  });

  test("defaults to the lg breakpoint's column count", () => {
    expect(GRID_COLUMNS).toBe(12);
  });
});

describe("parseWidgetLayouts", () => {
  test("keeps well formed layouts", () => {
    const widgets = [{ layout: { x: 0, y: 0, w: 4, h: 4 } }, { layout: { x: 4, y: 0, w: 4, h: 4 } }];

    expect(parseWidgetLayouts(widgets)).toEqual([
      { x: 0, y: 0, w: 4, h: 4 },
      { x: 4, y: 0, w: 4, h: 4 },
    ]);
  });

  test("drops rows whose JSON is not a layout", () => {
    const widgets = [
      { layout: null },
      { layout: "nope" },
      { layout: { x: 0, y: 0 } },
      { layout: { x: 0, y: 0, w: 0, h: 4 } },
      { layout: { x: 0, y: 0, w: 4, h: 4 } },
    ];

    expect(parseWidgetLayouts(widgets)).toEqual([{ x: 0, y: 0, w: 4, h: 4 }]);
  });
});
