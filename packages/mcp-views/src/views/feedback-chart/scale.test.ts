import { describe, expect, test } from "vitest";
import { linearScale, nearestIndex, niceStep, niceTicks, resolveYAxis } from "./scale";

describe("niceStep", () => {
  test("rounds to the nearest 1, 2 or 5 times a power of ten", () => {
    expect(niceStep(0.8)).toBe(1);
    expect(niceStep(1.3)).toBe(1);
    expect(niceStep(2.4)).toBe(2);
    expect(niceStep(3.2)).toBe(5);
    expect(niceStep(7)).toBe(10);
    expect(niceStep(0.032)).toBe(0.05);
    expect(niceStep(120)).toBe(100);
  });

  test("falls back to 1 for a step that is not a positive number", () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(Number.NaN)).toBe(1);
    expect(niceStep(-4)).toBe(1);
  });
});

describe("niceTicks", () => {
  test("covers the data with round bounds", () => {
    expect(niceTicks(0, 93)).toEqual({ ticks: [0, 20, 40, 60, 80, 100], min: 0, max: 100, step: 20 });
    expect(niceTicks(-100, 100).ticks).toEqual([-100, -50, 0, 50, 100]);
  });

  test("handles a flat or empty range", () => {
    expect(niceTicks(0, 0).ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    const flat = niceTicks(40, 40);
    expect(flat.min).toBeLessThan(40);
    expect(flat.max).toBeGreaterThan(40);
  });

  test("does not accumulate floating point error", () => {
    expect(niceTicks(0, 0.3, 4).ticks).toEqual([0, 0.1, 0.2, 0.3]);
  });
});

describe("resolveYAxis", () => {
  test("always includes zero", () => {
    const axis = resolveYAxis({ values: [120, 150] });
    expect(axis.min).toBe(0);
    expect(axis.max).toBeGreaterThanOrEqual(150);
  });

  test("extends below zero for negative data", () => {
    expect(resolveYAxis({ values: [-30, 10] }).min).toBeLessThanOrEqual(-30);
  });

  test("stays on a bounded score's own range, widening only if the data leaves it", () => {
    const axis = resolveYAxis({ values: [10, 40], fixed: [-100, 100] });
    expect([axis.min, axis.max]).toEqual([-100, 100]);
    expect(axis.ticks).toEqual([-100, -50, 0, 50, 100]);
    expect(resolveYAxis({ values: [10], fixed: [-100, 100], target: 2 }).ticks).toEqual([-100, 100]);
    expect(resolveYAxis({ values: [150], fixed: [-100, 100] }).max).toBeGreaterThanOrEqual(150);
  });

  test("ignores non-finite values and an empty list", () => {
    expect(resolveYAxis({ values: [Number.NaN, 4] }).max).toBeGreaterThanOrEqual(4);
    expect(resolveYAxis({ values: [] }).ticks.length).toBeGreaterThan(1);
  });
});

describe("linearScale", () => {
  test("maps the domain onto the range, including an inverted range", () => {
    expect(linearScale([0, 100], [200, 0])(25)).toBe(150);
    expect(linearScale([0, 10], [0, 100])(5)).toBe(50);
  });

  test("a zero-width domain maps to the middle", () => {
    expect(linearScale([3, 3], [0, 100])(3)).toBe(50);
  });
});

describe("nearestIndex", () => {
  test("finds the closest position", () => {
    const positions = [0, 10, 20, 40];
    expect(nearestIndex(positions, -5)).toBe(0);
    expect(nearestIndex(positions, 4)).toBe(0);
    expect(nearestIndex(positions, 6)).toBe(1);
    expect(nearestIndex(positions, 31)).toBe(3);
    expect(nearestIndex(positions, 999)).toBe(3);
    expect(nearestIndex([], 3)).toBe(-1);
  });
});
