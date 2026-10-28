import { describe, expect, test } from "vitest";
import type { CartesianData, PieData } from "./series";
import {
  announce,
  buildCartesianTooltip,
  buildPieTooltip,
  describeCartesianPoint,
  describePieSlice,
} from "./tooltip";

const context = { locale: "en-US" };

const data: CartesianData = {
  categories: [
    { id: "a", label: "Jan", fullLabel: "January 2026", raw: "a" },
    { id: "b", label: "Feb", fullLabel: "February 2026", raw: "b" },
  ],
  series: [
    { id: "pos", label: "Positive", colorIndex: 0, measureId: "m", values: [1200, null] },
    { id: "neg", label: "Negative", colorIndex: 1, measureId: "m", values: [30.5, 4] },
  ],
  isTime: true,
  granularity: "month",
  hiddenSeries: 0,
  hiddenCategories: 0,
};

describe("buildCartesianTooltip", () => {
  test("lists every series at the category with full values and marks the active one", () => {
    expect(buildCartesianTooltip(data, { category: 0, series: 1 }, context)).toEqual({
      title: "January 2026",
      rows: [
        { colorIndex: 0, label: "Positive", value: "1,200", emphasis: false },
        { colorIndex: 1, label: "Negative", value: "30.5", emphasis: true },
      ],
    });
  });

  test("a missing value reads as no data, not zero", () => {
    expect(buildCartesianTooltip(data, { category: 1, series: 0 }, context)?.rows[0].value).toBe("No data");
  });

  test("a single series is never singled out", () => {
    const single = { ...data, series: [data.series[0]] };
    expect(buildCartesianTooltip(single, { category: 0, series: 0 }, context)?.rows[0].emphasis).toBe(false);
  });

  test("is undefined for a position that does not exist", () => {
    expect(buildCartesianTooltip(data, { category: 9, series: 0 }, context)).toBeUndefined();
  });
});

describe("pie", () => {
  const pie: PieData = {
    slices: [{ id: "a", label: "Positive", value: 75, share: 0.75, colorIndex: 0 }],
    total: 100,
    skipped: 0,
  };

  test("tooltip shows the value and its share", () => {
    expect(buildPieTooltip(pie, { category: 0, series: 0 }, "Feedback Records", context)).toEqual({
      title: "Positive",
      rows: [{ colorIndex: 0, label: "Feedback Records", value: "75 (75%)" }],
    });
    expect(buildPieTooltip(pie, { category: 3, series: 0 }, "x", context)).toBeUndefined();
  });

  test("describes the slice for the message", () => {
    expect(
      describePieSlice(
        pie,
        { category: 0, series: 0 },
        { chartTitle: "T", xLabel: "Sentiment", measureLabel: "Feedback Records" },
        context
      )
    ).toEqual({
      chartTitle: "T",
      xLabel: "Sentiment",
      xValue: "Positive",
      measureLabel: "Feedback Records",
      valueText: "75",
    });
  });
});

describe("announce", () => {
  test("reads the title and each row", () => {
    expect(
      announce({
        title: "Jan",
        rows: [
          { label: "Positive", value: "5" },
          { label: "Negative", value: "1" },
        ],
      })
    ).toBe("Jan: Positive 5, Negative 1");
    expect(announce(undefined)).toBe("");
  });
});

describe("describeCartesianPoint", () => {
  test("with a series dimension the measure stays the measure and the series is named", () => {
    expect(
      describeCartesianPoint(
        data,
        { category: 0, series: 1 },
        {
          chartTitle: "T",
          xLabel: "Collected At (month)",
          seriesLabel: "Sentiment",
          measureLabel: "Feedback Records",
          granularity: "month",
        },
        context
      )
    ).toEqual({
      chartTitle: "T",
      xLabel: "Collected At (month)",
      xValue: "January 2026",
      granularity: "month",
      seriesLabel: "Sentiment",
      seriesValue: "Negative",
      measureLabel: "Feedback Records",
      valueText: "30.5",
    });
  });

  test("without one the series is the measure", () => {
    const target = describeCartesianPoint(
      data,
      { category: 0, series: 0 },
      { chartTitle: "T", xLabel: "X", measureLabel: "ignored" },
      context
    );
    expect(target?.measureLabel).toBe("Positive");
    expect(target?.seriesLabel).toBeUndefined();
  });

  test("is undefined for a position that does not exist", () => {
    expect(
      describeCartesianPoint(
        data,
        { category: 0, series: 7 },
        { chartTitle: "T", xLabel: "X", measureLabel: "M" },
        context
      )
    ).toBeUndefined();
  });
});
