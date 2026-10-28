import { describe, expect, test } from "vitest";
import type { ChartRow, ChartSpec, FeedbackChartModel } from "./model";
import {
  MAX_BAR_CATEGORIES,
  MAX_PIE_SLICES,
  MAX_SERIES,
  buildCartesian,
  buildNumbers,
  buildPie,
} from "./series";

const model = (
  spec: Partial<ChartSpec>,
  rows: ChartRow[],
  domain?: [number, number]
): FeedbackChartModel => ({
  spec: { type: "bar", title: "T", y: ["m"], ...spec },
  columns: [
    { id: "x", label: "X", kind: "dimension" },
    { id: "s", label: "Series", kind: "dimension" },
    { id: "m", label: "Measure", kind: "measure", ...(domain ? { domain } : {}) },
    { id: "n", label: "Other measure", kind: "measure" },
  ],
  rows,
  truncated: false,
});

const context = { locale: "en-US" };

describe("buildCartesian", () => {
  test("one category per row and one series per plotted measure, null staying null", () => {
    const data = buildCartesian(
      model({ x: "x", xKind: "category", y: ["m", "n"] }, [
        { x: "a", m: 1, n: 10 },
        { x: "b", m: null, n: 20 },
      ]),
      context
    );
    expect(data.categories.map((c) => c.label)).toEqual(["a", "b"]);
    expect(data.series.map((s) => [s.label, s.values, s.colorIndex])).toEqual([
      ["Measure", [1, null], 0],
      ["Other measure", [10, 20], 1],
    ]);
  });

  test("humanizes the grouping values and names empty groups", () => {
    const data = buildCartesian(
      {
        ...model({ x: "FeedbackRecords.sentiment" }, [
          { "FeedbackRecords.sentiment": "very_positive", m: 3 },
          { "FeedbackRecords.sentiment": null, m: 1 },
        ]),
        columns: [],
      },
      context
    );
    expect(data.categories.map((c) => c.label)).toEqual(["Very positive", "Not enriched"]);
  });

  test("a series dimension splits the one measure, with colours in first-appearance order", () => {
    const data = buildCartesian(
      model({ x: "x", series: "s", xKind: "category", y: ["m"] }, [
        { x: "a", s: "pos", m: 1 },
        { x: "a", s: "neg", m: 2 },
        { x: "b", s: "neg", m: 3 },
      ]),
      context
    );
    expect(data.series.map((s) => [s.id, s.values, s.colorIndex])).toEqual([
      ["pos", [1, null], 0],
      ["neg", [2, 3], 1],
    ]);
  });

  test("orders a time axis by time and labels it with the year only when it spans years", () => {
    const rows = [
      { x: "2026-02-01T00:00:00.000", m: 2 },
      { x: "2025-12-01T00:00:00.000", m: 1 },
    ];
    const data = buildCartesian(
      model({ type: "line", x: "x", xKind: "time", granularity: "month", y: ["m"] }, rows),
      context
    );
    expect(data.isTime).toBe(true);
    expect(data.categories.map((c) => c.label)).toEqual(["Dec 2025", "Feb 2026"]);
    expect(data.categories.map((c) => c.fullLabel)).toEqual(["December 2025", "February 2026"]);
    expect(data.series[0].values).toEqual([1, 2]);

    const sameYear = buildCartesian(
      model({ type: "line", x: "x", xKind: "time", granularity: "month", y: ["m"] }, [
        { x: "2026-01-01T00:00:00.000", m: 1 },
        { x: "2026-02-01T00:00:00.000", m: 2 },
      ]),
      context
    );
    expect(sameYear.categories.map((c) => c.label)).toEqual(["Jan", "Feb"]);
  });

  test("keeps the eight largest series with the colours they had, and counts the rest", () => {
    const rows: ChartRow[] = [];
    for (let i = 0; i < 10; i += 1) rows.push({ x: "a", s: `s${i}`, m: i === 1 ? 1000 : i });
    const data = buildCartesian(model({ x: "x", series: "s", xKind: "category", y: ["m"] }, rows), context);
    expect(data.series).toHaveLength(MAX_SERIES);
    expect(data.hiddenSeries).toBe(2);
    expect(data.series.map((s) => s.id)).toContain("s1");
    expect(data.series.map((s) => s.id)).not.toContain("s0");
    expect(data.series.map((s) => s.colorIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  test("a bar chart keeps its first categories and counts the rest", () => {
    const rows: ChartRow[] = Array.from({ length: 40 }, (_, i) => ({ x: `c${i}`, m: i }));
    const data = buildCartesian(model({ x: "x", xKind: "category", y: ["m"] }, rows), context);
    expect(data.categories).toHaveLength(MAX_BAR_CATEGORIES);
    expect(data.series[0].values).toHaveLength(MAX_BAR_CATEGORIES);
    expect(data.hiddenCategories).toBe(10);
  });

  test("carries the plotted score's fixed range, but not when measures with different scales share the chart", () => {
    const rows = [{ x: "a", m: 10, n: 4 }];
    expect(buildCartesian(model({ x: "x", y: ["m"] }, rows, [-100, 100]), context).fixedDomain).toEqual([
      -100, 100,
    ]);
    expect(
      buildCartesian(model({ x: "x", y: ["m", "n"] }, rows, [-100, 100]), context).fixedDomain
    ).toBeUndefined();
  });

  test("a spec without x draws nothing", () => {
    const data = buildCartesian(model({ y: ["m"] }, [{ m: 1 }]), context);
    expect(data.categories).toEqual([]);
    expect(data.series).toEqual([]);
  });
});

describe("buildPie", () => {
  test("sorts by size, shares add up to one, zero and missing values are skipped", () => {
    const pie = buildPie(
      model({ type: "pie", x: "x", y: ["m"] }, [
        { x: "a", m: 1 },
        { x: "b", m: 3 },
        { x: "c", m: 0 },
        { x: "d", m: null },
      ]),
      context
    );
    expect(pie.slices.map((s) => s.id)).toEqual(["b", "a"]);
    expect(pie.slices.map((s) => s.share)).toEqual([0.75, 0.25]);
    expect(pie.total).toBe(4);
    expect(pie.skipped).toBe(2);
  });

  test("folds everything past seven slices into Other", () => {
    const rows: ChartRow[] = Array.from({ length: 10 }, (_, i) => ({ x: `c${i}`, m: 10 - i }));
    const pie = buildPie(model({ type: "pie", x: "x", y: ["m"] }, rows), context);
    expect(pie.slices).toHaveLength(MAX_PIE_SLICES);
    const other = pie.slices[pie.slices.length - 1];
    expect(other).toMatchObject({ id: "__other__", label: "Other (4)", colorIndex: null, merged: 4 });
    expect(other.value).toBe(4 + 3 + 2 + 1);
    expect(pie.slices.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 10);
    expect(pie.slices.slice(0, -1).map((s) => s.colorIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("exactly seven categories need no Other", () => {
    const rows: ChartRow[] = Array.from({ length: 7 }, (_, i) => ({ x: `c${i}`, m: 1 }));
    expect(buildPie(model({ type: "pie", x: "x", y: ["m"] }, rows), context).slices).toHaveLength(7);
  });

  test("nothing to draw when no slice is positive", () => {
    expect(buildPie(model({ type: "pie", x: "x", y: ["m"] }, [{ x: "a", m: 0 }]), context)).toEqual({
      slices: [],
      total: 0,
      skipped: 1,
    });
  });
});

describe("buildNumbers", () => {
  test("one number per measure with compact and full text", () => {
    const numbers = buildNumbers(
      model({ type: "number", y: ["m", "n"] }, [{ m: 12345, n: 31.456 }]),
      context
    );
    expect(numbers.map((n) => [n.label, n.compact, n.full])).toEqual([
      ["Measure", "12.3K", "12,345"],
      ["Other measure", "31.5", "31.46"],
    ]);
  });

  test("a missing score is no data, never zero", () => {
    const [number] = buildNumbers(model({ type: "number", y: ["m"] }, [{ m: null }]), context);
    expect(number.value).toBeNull();
    expect(number.compact).toBe("No data");
    expect(buildNumbers(model({ type: "number", y: ["m"] }, []), context)[0].value).toBeNull();
  });
});
