import { describe, expect, test } from "vitest";
import { boundLayout, repairLayouts } from "./utils";

const widget = (id: string, layout: unknown, order = 0) => ({ id, layout, order });

describe("boundLayout", () => {
  test("keeps a layout already within the grid", () => {
    expect(boundLayout({ x: 4, y: 2, w: 8, h: 8 })).toEqual({ x: 4, y: 2, w: 8, h: 8 });
  });

  test("clamps a height above the limit and a width past the last column", () => {
    expect(boundLayout({ x: 0, y: 0, w: 4, h: 10 })).toEqual({ x: 0, y: 0, w: 4, h: 8 });
    expect(boundLayout({ x: 10, y: 0, w: 4, h: 3 })).toEqual({ x: 8, y: 0, w: 4, h: 3 });
    expect(boundLayout({ x: 0, y: 0, w: 20, h: 3 })).toEqual({ x: 0, y: 0, w: 12, h: 3 });
  });

  test("rounds fractions and falls back to the default for a missing or unreadable value", () => {
    expect(boundLayout({ x: 1.4, y: 2.6, w: 3, h: 2 })).toEqual({ x: 1, y: 3, w: 3, h: 2 });
    expect(boundLayout({})).toEqual({ x: 0, y: 0, w: 4, h: 3 });
    expect(boundLayout(null)).toEqual({ x: 0, y: 0, w: 4, h: 3 });
    expect(boundLayout({ x: "2", y: -5, w: 0, h: Number.NaN })).toEqual({ x: 0, y: 0, w: 1, h: 3 });
  });
});

describe("repairLayouts", () => {
  test("changes nothing on a dashboard the API already accepts", () => {
    expect(
      repairLayouts([widget("a", { x: 0, y: 0, w: 6, h: 4 }), widget("b", { x: 6, y: 0, w: 6, h: 4 })])
    ).toEqual([]);
  });

  test("moves an overlapping widget straight down, keeping its column and size", () => {
    expect(
      repairLayouts([widget("a", { x: 0, y: 0, w: 6, h: 4 }), widget("b", { x: 3, y: 2, w: 6, h: 3 })])
    ).toEqual([{ id: "b", layout: { x: 3, y: 4, w: 6, h: 3 } }]);
  });

  test("keeps pushing until clear of every widget, not just the first it hit", () => {
    const repaired = repairLayouts([
      widget("a", { x: 0, y: 0, w: 4, h: 2 }),
      widget("b", { x: 4, y: 0, w: 4, h: 5 }),
      widget("c", { x: 2, y: 1, w: 4, h: 2 }),
    ]);
    expect(repaired).toEqual([{ id: "c", layout: { x: 2, y: 5, w: 4, h: 2 } }]);
  });

  test("breaks a tie on the same cell by saved order", () => {
    expect(
      repairLayouts([
        widget("late", { x: 0, y: 0, w: 4, h: 3 }, 1),
        widget("early", { x: 0, y: 0, w: 4, h: 3 }, 0),
      ])
    ).toEqual([{ id: "late", layout: { x: 0, y: 3, w: 4, h: 3 } }]);
  });

  test("bounds a too-tall widget, then clears what it no longer covers or now covers", () => {
    expect(
      repairLayouts([
        widget("tall", { x: 0, y: 0, w: 12, h: 10 }),
        widget("below", { x: 0, y: 10, w: 12, h: 2 }),
      ])
    ).toEqual([{ id: "tall", layout: { x: 0, y: 0, w: 12, h: 8 } }]);
  });

  test("rewrites a layout with extra keys even when its numbers are fine", () => {
    expect(repairLayouts([widget("a", { x: 0, y: 0, w: 4, h: 3, i: "a" })])).toEqual([
      { id: "a", layout: { x: 0, y: 0, w: 4, h: 3 } },
    ]);
  });

  test("is idempotent: a repaired dashboard needs nothing more", () => {
    const stored = [
      widget("a", { x: 0, y: 0, w: 12, h: 10 }, 0),
      widget("b", { x: 0, y: 2, w: 6, h: 4 }, 1),
      widget("c", { x: 3, y: 2, w: 6, h: 4 }, 2),
    ];
    const repaired = new Map(repairLayouts(stored).map(({ id, layout }) => [id, layout]));
    const after = stored.map((w) => ({ ...w, layout: repaired.get(w.id) ?? w.layout }));
    expect(repairLayouts(after)).toEqual([]);
  });

  test("repairs thousands of identical layouts in linear time, stacking them in saved order", () => {
    const planted = Array.from({ length: 5000 }, (_, index) =>
      widget(`w${index}`, { x: 0, y: 0, w: 12, h: 1 }, index)
    );

    const started = performance.now();
    const repaired = repairLayouts(planted);
    expect(performance.now() - started).toBeLessThan(1000);

    expect(repaired).toHaveLength(4999);
    expect(repaired[repaired.length - 1]).toEqual({ id: "w4999", layout: { x: 0, y: 4999, w: 12, h: 1 } });
  });
});
