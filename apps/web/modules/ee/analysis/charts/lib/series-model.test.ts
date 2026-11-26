import { describe, expect, test } from "vitest";
import { EMPTY_GROUP_VALUE, getChartGrouping } from "./chart-series";
import { CHART_SENTIMENT_COLORS } from "./chart-utils";
import {
  buildSeriesModel,
  createGroupValueFormatter,
  getAreaFillOpacity,
  getSeriesValueScales,
  orderMeasureKeys,
} from "./series-model";

const COUNT = "FeedbackRecords.count";
const SOURCE = "FeedbackRecords.sourceName";
const SENTIMENT = "FeedbackRecords.sentiment";
const WEEK = "FeedbackRecords.collectedAt.week";
const formatGroupValue = (_dim: string, value: unknown) => String(value);

describe("orderMeasureKeys", () => {
  test("canonical measure order, groupings dropped, unknown keys last", () => {
    expect(
      orderMeasureKeys(
        ["x", "FeedbackRecords.negativeCount", "FeedbackRecords.positiveCount", SOURCE],
        [SOURCE]
      )
    ).toEqual(["FeedbackRecords.positiveCount", "FeedbackRecords.negativeCount", "x"]);
  });
});

describe("buildSeriesModel", () => {
  test("grouped by sentiment: one series per value, semantic colors, labels from the formatter", () => {
    const query = { measures: [COUNT], dimensions: [SOURCE, SENTIMENT] };
    const model = buildSeriesModel({
      data: [
        { [SOURCE]: "Web", [SENTIMENT]: "positive", [COUNT]: 3 },
        { [SOURCE]: "Web", [SENTIMENT]: "negative", [COUNT]: 1 },
        { [SOURCE]: "Email", [SENTIMENT]: "positive", [COUNT]: 9 },
      ],
      grouping: getChartGrouping(query),
      xAxisKey: SOURCE,
      hasCategoryAxis: true,
      isGrouped: true,
      measureKeys: [COUNT],
      measureLabels: { [COUNT]: "Records" },
      formatGroupValue,
    });
    expect(model.rows.map((row) => row[SOURCE])).toEqual(["Email", "Web"]);
    expect(Object.values(model.seriesConfig)).toEqual([
      { label: "negative", color: CHART_SENTIMENT_COLORS.negative },
      { label: "positive", color: CHART_SENTIMENT_COLORS.positive },
    ]);
    expect(new Set(Object.values(model.seriesMeasure))).toEqual(new Set([COUNT]));
  });

  test("time axis keeps chronological order", () => {
    const query = {
      measures: [COUNT],
      dimensions: [SOURCE],
      timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", granularity: "week" as const }],
    };
    const model = buildSeriesModel({
      data: [
        { [WEEK]: "2026-11-09", [SOURCE]: "Web", [COUNT]: 1 },
        { [WEEK]: "2026-11-02", [SOURCE]: "Web", [COUNT]: 9 },
      ],
      grouping: getChartGrouping(query),
      xAxisKey: WEEK,
      hasCategoryAxis: true,
      isGrouped: true,
      measureKeys: [COUNT],
      measureLabels: { [COUNT]: "Records" },
      formatGroupValue,
    });
    expect(model.rows.map((row) => row[WEEK])).toEqual(["2026-11-02", "2026-11-09"]);
  });

  test("several measures label each series with its measure", () => {
    const promoter = "FeedbackRecords.promoterCount";
    const query = { measures: [COUNT, promoter], dimensions: [SOURCE, SENTIMENT] };
    const model = buildSeriesModel({
      data: [{ [SOURCE]: "Web", [SENTIMENT]: "positive", [COUNT]: 3, [promoter]: 1 }],
      grouping: getChartGrouping(query),
      xAxisKey: SOURCE,
      hasCategoryAxis: true,
      isGrouped: true,
      measureKeys: [COUNT, promoter],
      measureLabels: { [COUNT]: "Records", [promoter]: "Promoters" },
      formatGroupValue,
    });
    expect(Object.values(model.seriesConfig).map((entry) => entry.label)).toEqual([
      "Records · positive",
      "Promoters · positive",
    ]);
  });

  test("ungrouped category axis goes largest first, measures are the series", () => {
    const query = { measures: [COUNT], dimensions: [SOURCE] };
    const model = buildSeriesModel({
      data: [
        { [SOURCE]: "A", [COUNT]: 1 },
        { [SOURCE]: "B", [COUNT]: 5 },
      ],
      grouping: getChartGrouping(query),
      xAxisKey: SOURCE,
      hasCategoryAxis: true,
      isGrouped: false,
      measureKeys: [COUNT],
      measureLabels: { [COUNT]: "Records" },
      formatGroupValue,
    });
    expect(model.rows.map((row) => row[SOURCE])).toEqual(["B", "A"]);
    expect(model.dataKeys).toEqual([COUNT]);
  });

  test.each([false, true])(
    "projects boolean categories into chart keys and keeps the empty group distinct (grouped: %s)",
    (isGrouped) => {
      const dimension = "FeedbackRecords.metadataFinished";
      const data = [
        { [dimension]: false, [SOURCE]: "Web", [COUNT]: 2 },
        { [dimension]: true, [SOURCE]: "Web", [COUNT]: 3 },
        { [dimension]: EMPTY_GROUP_VALUE, [SOURCE]: "Email", [COUNT]: 1 },
      ];
      const dimensions = isGrouped ? [dimension, SOURCE] : [dimension];
      const model = buildSeriesModel({
        data,
        grouping: getChartGrouping({ measures: [COUNT], dimensions }),
        xAxisKey: dimension,
        hasCategoryAxis: true,
        isGrouped,
        measureKeys: [COUNT],
        measureLabels: { [COUNT]: "Records" },
        formatGroupValue,
      });

      expect(model.rows.map((row) => row[dimension])).toEqual(["true", "false", EMPTY_GROUP_VALUE]);
      expect(data.map((row) => row[dimension])).toEqual([false, true, EMPTY_GROUP_VALUE]);
    }
  );
});

describe("getAreaFillOpacity", () => {
  test("line, grouped area, plain area", () => {
    expect(getAreaFillOpacity(true, true)).toBe(0.6);
    expect(getAreaFillOpacity(false, true)).toBe(0.15);
    expect(getAreaFillOpacity(false, false)).toBe(0.4);
  });
});

describe("createGroupValueFormatter", () => {
  const t = ((key: string) => key) as unknown as Parameters<typeof createGroupValueFormatter>[0];

  test.each(["FeedbackRecords.metadataFinished", "FeedbackRecords.valueBoolean"])(
    "localizes boolean categories for %s",
    (dimension) => {
      const format = createGroupValueFormatter(t);
      expect(format(dimension, true)).toBe("common.true");
      expect(format(dimension, "true")).toBe("common.true");
      expect(format(dimension, false)).toBe("common.false");
      expect(format(dimension, "false")).toBe("common.false");
      expect(format(dimension, EMPTY_GROUP_VALUE)).toBe("workspace.analysis.charts.no_value");
      expect(format(SOURCE, "false")).toBe("false");
    }
  );

  test("names the empty group by its bucket, else (no value)", () => {
    const format = createGroupValueFormatter(t);
    expect(format(SOURCE, EMPTY_GROUP_VALUE)).toBe("workspace.analysis.charts.no_value");
    expect(format(SENTIMENT, EMPTY_GROUP_VALUE)).toBe("workspace.analysis.charts.not_enriched");
  });

  test("resolves a choice id to its survey text", () => {
    const format = createGroupValueFormatter(t, { opt1: "Very satisfied" });
    expect(format("FeedbackRecords.valueId", "opt1")).toBe("Very satisfied");
    expect(format(SOURCE, "Web")).toBe("Web");
  });
});

describe("getSeriesValueScales", () => {
  test("a stacked bar axis reaches the tallest stack", () => {
    const rows = [{ a: 30, b: 40 }];
    const { barScale } = getSeriesValueScales({
      data: [],
      rows,
      dataKeys: ["a", "b"],
      measureKeys: [COUNT],
      isGrouped: true,
      isStacked: true,
    });
    expect(barScale?.domain[1]).toBeGreaterThanOrEqual(70);
  });

  test("ungrouped, unstacked charts derive their own axis", () => {
    expect(
      getSeriesValueScales({
        data: [],
        rows: [],
        dataKeys: [],
        measureKeys: [],
        isGrouped: false,
        isStacked: false,
      })
    ).toEqual({ barScale: undefined, areaScale: undefined });
  });
});
