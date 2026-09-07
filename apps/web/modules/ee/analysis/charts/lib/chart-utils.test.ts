import { describe, expect, test } from "vitest";
import { SENTIMENT_VALUE_ORDER } from "@/modules/ee/analysis/lib/schema-definition";
import {
  CATEGORY_AXIS_MAX_WIDTH,
  CATEGORY_AXIS_MIN_WIDTH,
  CHART_BRAND_DARK,
  CHART_MEASURE_COLORS,
  CHART_NOT_ENRICHED_COLOR,
  CHART_SENTIMENT_COLORS,
  PIE_MEASURE_NAME_KEY,
  PIE_MEASURE_VALUE_KEY,
  PIVOTED_MEASURE_KEY,
  PIVOTED_VALUE_KEY,
  VALUE_LABEL_MAX_PADDING,
  VALUE_LABEL_MIN_PADDING,
  buildDistributionSegments,
  formatCellValue,
  formatPercentShare,
  formatXAxisTick,
  getCategoryAxisWidth,
  getSemanticDimensionColor,
  getSentimentMeasureColor,
  getValueLabelPadding,
  pivotMeasuresToCategories,
  prepareMeasureSliceData,
  preparePieData,
  resolveChartType,
} from "./chart-utils";

describe("chart-utils", () => {
  describe("prepareMeasureSliceData", () => {
    const label = (k: string) => `L:${k}`;

    test("pivots each measure column into its own slice", () => {
      const rows = [{ "m.joy": 1163, "m.anger": 1050, "m.fear": 3 }];
      const result = prepareMeasureSliceData(rows, ["m.joy", "m.anger", "m.fear"], label);
      expect(result).toEqual([
        { [PIE_MEASURE_NAME_KEY]: "L:m.joy", [PIE_MEASURE_VALUE_KEY]: 1163, tooltipLabel: "L:m.joy" },
        { [PIE_MEASURE_NAME_KEY]: "L:m.anger", [PIE_MEASURE_VALUE_KEY]: 1050, tooltipLabel: "L:m.anger" },
        { [PIE_MEASURE_NAME_KEY]: "L:m.fear", [PIE_MEASURE_VALUE_KEY]: 3, tooltipLabel: "L:m.fear" },
      ]);
    });

    // The tooltip labels each row from its dataKey, which for these slices is the internal
    // PIE_MEASURE_VALUE_KEY — without tooltipLabel it renders that raw key (ENG-2346).
    test("labels every slice for the tooltip, never leaving the internal value key exposed", () => {
      const rows = [{ "m.joy": 10, "m.anger": 2 }];
      const result = prepareMeasureSliceData(rows, ["m.joy", "m.anger"], label);
      expect(result.map((row) => row.tooltipLabel)).toEqual(["L:m.joy", "L:m.anger"]);
      expect(result.every((row) => !String(row.tooltipLabel).includes(PIE_MEASURE_VALUE_KEY))).toBe(true);
    });

    test("sums a measure across multiple rows and treats non-numeric as 0", () => {
      const rows = [
        { "m.joy": 10, "m.anger": "x" },
        { "m.joy": 5, "m.anger": 2 },
      ];
      const result = prepareMeasureSliceData(rows, ["m.joy", "m.anger"], label);
      expect(result).toEqual([
        { [PIE_MEASURE_NAME_KEY]: "L:m.joy", [PIE_MEASURE_VALUE_KEY]: 15, tooltipLabel: "L:m.joy" },
        { [PIE_MEASURE_NAME_KEY]: "L:m.anger", [PIE_MEASURE_VALUE_KEY]: 2, tooltipLabel: "L:m.anger" },
      ]);
    });

    // ENG-2346: the tooltip falls back to formatting a row's dataKey when the row carries no
    // `tooltipLabel`, and the slice value lives under a synthetic key that is not a Cube column —
    // so a missing label surfaced to users as the literal "__measure Value".
    test("carries the translated measure label so the tooltip never formats the synthetic value key", () => {
      const result = prepareMeasureSliceData([{ "m.joy": 236 }], ["m.joy"], label);
      expect(result[0].tooltipLabel).toBe("L:m.joy");
    });
  });

  describe("resolveChartType", () => {
    test("returns valid chart types", () => {
      expect(resolveChartType("area")).toBe("area");
      expect(resolveChartType("bar")).toBe("bar");
      expect(resolveChartType("pie")).toBe("pie");
      expect(resolveChartType("big_number")).toBe("big_number");
    });

    test("maps the retired line type onto area rather than the bar fallback", () => {
      expect(resolveChartType("line")).toBe("area");
    });

    test("defaults to bar for invalid type", () => {
      expect(resolveChartType("invalid")).toBe("bar");
      expect(resolveChartType("")).toBe("bar");
      // An inherited Object key must not resolve through the legacy alias lookup.
      expect(resolveChartType("constructor")).toBe("bar");
    });
  });

  describe("buildDistributionSegments", () => {
    test("sizes each section by its share of the total", () => {
      const result = buildDistributionSegments([
        { key: "a", label: "A", value: 30 },
        { key: "b", label: "B", value: 10 },
      ]);
      expect(result).not.toBeNull();
      expect(result!.total).toBe(40);
      expect(result!.segments.map((s) => s.percent)).toEqual([0.75, 0.25]);
    });

    test("orders sections largest first, the order preparePieData uses", () => {
      const result = buildDistributionSegments([
        { key: "small", label: "Small", value: 1 },
        { key: "big", label: "Big", value: 99 },
      ]);
      expect(result!.segments.map((s) => s.key)).toEqual(["big", "small"]);
    });

    test("keeps the caller's order for equal shares, so the palette handout is stable", () => {
      const result = buildDistributionSegments([
        { key: "a", label: "A", value: 5 },
        { key: "b", label: "B", value: 5 },
        { key: "c", label: "C", value: 5 },
      ]);
      expect(result!.segments.map((s) => s.key)).toEqual(["a", "b", "c"]);
    });

    test("drops non-positive and non-numeric entries from the total", () => {
      const result = buildDistributionSegments([
        { key: "a", label: "A", value: 10 },
        { key: "zero", label: "Zero", value: 0 },
        { key: "negative", label: "Negative", value: -5 },
        { key: "text", label: "Text", value: "n/a" },
        { key: "empty", label: "Empty", value: null },
      ]);
      expect(result!.total).toBe(10);
      expect(result!.segments.map((s) => s.key)).toEqual(["a"]);
    });

    test("returns null when nothing positive is left to show", () => {
      expect(buildDistributionSegments([])).toBeNull();
      expect(buildDistributionSegments([{ key: "a", label: "A", value: 0 }])).toBeNull();
      expect(buildDistributionSegments([{ key: "a", label: "A", value: "text" }])).toBeNull();
    });

    test("keeps semantic colors and hands the palette only to the rest", () => {
      const result = buildDistributionSegments([
        { key: "positive", label: "Positive", value: 5, color: CHART_SENTIMENT_COLORS.positive },
        { key: "other", label: "Other", value: 5 },
        { key: "another", label: "Another", value: 5 },
      ]);
      expect(result!.segments.map((s) => s.color)).toEqual([
        CHART_SENTIMENT_COLORS.positive,
        CHART_MEASURE_COLORS[0],
        CHART_MEASURE_COLORS[1],
      ]);
    });
  });

  describe("preparePieData", () => {
    test("returns null for empty or no valid numeric data", () => {
      expect(preparePieData([], "count")).toBeNull();
      expect(preparePieData([{ label: "A", count: "text" }], "count")).toBeNull();
      expect(preparePieData([{ label: "A", count: null }], "count")).toBeNull();
    });

    test("drops zero-value rows alongside non-numeric ones", () => {
      const data = [
        { sentiment: "positive", count: 10 },
        { sentiment: "neutral", count: 0 },
        { sentiment: "skip", count: "n/a" },
      ];
      const result = preparePieData(data, "count");
      expect(result).not.toBeNull();
      expect(result!.processedData).toHaveLength(1);
      expect(result!.processedData[0].sentiment).toBe("positive");
    });

    test("colours slices from the mixed measure palette for distinguishability", () => {
      const data = [
        { sentiment: "positive", count: 10 },
        { sentiment: "negative", count: 5 },
        { sentiment: "skip", count: "n/a" },
      ];
      const result = preparePieData(data, "count");
      expect(result).not.toBeNull();
      expect(result!.processedData).toHaveLength(2);
      expect(result!.processedData[0].count).toBe(10);
      expect(result!.colors[0]).toBe(CHART_MEASURE_COLORS[0]);
      expect(result!.colors[1]).toBe(CHART_MEASURE_COLORS[1]);
    });

    test("greys the not-enriched slice and colours sentiment slices semantically", () => {
      const nameKey = "FeedbackRecords.sentiment";
      const data = [
        { [nameKey]: "", count: 20 }, // biggest → sorted first → not enriched
        { [nameKey]: "positive", count: 6 },
        { [nameKey]: "negative", count: 4 },
      ];
      const result = preparePieData(data, "count", nameKey);
      expect(result).not.toBeNull();
      // gray for the empty (not-enriched) slice; sentiment slices are keyed by enum value
      expect(result!.colors[0]).toBe(CHART_NOT_ENRICHED_COLOR);
      expect(result!.colors[1]).toBe(CHART_SENTIMENT_COLORS.positive);
      expect(result!.colors[2]).toBe(CHART_SENTIMENT_COLORS.negative);
    });

    test("falls back to the palette for unknown sentiment tokens without letting semantic slices consume hues", () => {
      const nameKey = "FeedbackRecords.sentiment";
      const data = [
        { [nameKey]: "very_positive", count: 9 },
        { [nameKey]: "unexpected_token", count: 5 },
        { [nameKey]: "another_unknown", count: 3 },
      ];
      const result = preparePieData(data, "count", nameKey);
      expect(result).not.toBeNull();
      expect(result!.colors[0]).toBe(CHART_SENTIMENT_COLORS.very_positive);
      // palette indices start at 0 for the non-semantic slices
      expect(result!.colors[1]).toBe(CHART_MEASURE_COLORS[0]);
      expect(result!.colors[2]).toBe(CHART_MEASURE_COLORS[1]);
    });

    test("uses palette colours when no nameKey is provided", () => {
      const data = [{ label: "A", count: 5 }];
      const result = preparePieData(data, "count");
      expect(result!.colors[0]).toBe(CHART_MEASURE_COLORS[0]);
    });
  });

  describe("formatXAxisTick", () => {
    test("returns empty for null/undefined", () => {
      expect(formatXAxisTick(null)).toBe("");
      expect(formatXAxisTick(undefined)).toBe("");
    });

    test("formats ISO date string", () => {
      expect(formatXAxisTick("2024-06-15")).toMatch(/Jun \d+, 2024/);
    });

    test("passes through non-date string", () => {
      expect(formatXAxisTick("hello")).toBe("hello");
    });

    test("formats number as string when it parses as date, else passes through", () => {
      expect(formatXAxisTick(1.5)).toBe("1.5");
    });

    test("does not interpret bare year-shaped strings as dates", () => {
      // parseISO("1000") is a valid year-only ISO date and would render as
      // "Jan 1, 1000" — but a 4-digit numeric category label shouldn't be
      // turned into a date.
      expect(formatXAxisTick("1000")).toBe("1000");
      expect(formatXAxisTick("2024")).toBe("2024");
      expect(formatXAxisTick(1000)).toBe("1000");
    });

    test("returns empty for boolean", () => {
      expect(formatXAxisTick(true)).toBe("");
    });
  });

  describe("formatCellValue", () => {
    test("returns empty for null/undefined", () => {
      expect(formatCellValue(null)).toBe("");
      expect(formatCellValue(undefined)).toBe("");
    });

    test("formats number with locale", () => {
      expect(formatCellValue(1000)).toBe("1,000");
      expect(formatCellValue(3.14)).toBe("3.14");
    });

    test("formats ISO date string", () => {
      expect(formatCellValue("2024-01-15")).toMatch(/Jan \d+, 2024/);
    });

    test("returns string as-is when not date", () => {
      expect(formatCellValue("hello")).toBe("hello");
    });

    test("stringifies object", () => {
      expect(formatCellValue({ a: 1 })).toBe('{"a":1}');
    });

    test("converts boolean and bigint", () => {
      expect(formatCellValue(true)).toBe("true");
      expect(formatCellValue(123n)).toBe("123");
    });
  });

  describe("getSemanticDimensionColor", () => {
    const sentimentDim = "FeedbackRecords.sentiment";

    test("maps every sentiment enum value to its semantic color", () => {
      for (const value of SENTIMENT_VALUE_ORDER) {
        expect(getSemanticDimensionColor(sentimentDim, value)).toBe(CHART_SENTIMENT_COLORS[value]);
      }
    });

    test("returns the not-enriched gray for empty enrichment values", () => {
      expect(getSemanticDimensionColor(sentimentDim, "")).toBe(CHART_NOT_ENRICHED_COLOR);
      expect(getSemanticDimensionColor(sentimentDim, null)).toBe(CHART_NOT_ENRICHED_COLOR);
      expect(getSemanticDimensionColor("FeedbackRecords.emotions", "")).toBe(CHART_NOT_ENRICHED_COLOR);
    });

    test("returns undefined for unknown tokens and non-sentiment dimensions", () => {
      expect(getSemanticDimensionColor(sentimentDim, "unexpected_token")).toBeUndefined();
      // emotions keep the generic palette (only their empty bucket is semantic)
      expect(getSemanticDimensionColor("FeedbackRecords.emotions", "joy")).toBeUndefined();
      expect(getSemanticDimensionColor("FeedbackRecords.language", "positive")).toBeUndefined();
    });
  });

  describe("getSentimentMeasureColor", () => {
    test("maps every sentiment count measure to the matching bucket color", () => {
      expect(getSentimentMeasureColor("FeedbackRecords.veryNegativeCount")).toBe(
        CHART_SENTIMENT_COLORS.very_negative
      );
      expect(getSentimentMeasureColor("FeedbackRecords.negativeCount")).toBe(CHART_SENTIMENT_COLORS.negative);
      expect(getSentimentMeasureColor("FeedbackRecords.neutralCount")).toBe(CHART_SENTIMENT_COLORS.neutral);
      expect(getSentimentMeasureColor("FeedbackRecords.positiveCount")).toBe(CHART_SENTIMENT_COLORS.positive);
      expect(getSentimentMeasureColor("FeedbackRecords.veryPositiveCount")).toBe(
        CHART_SENTIMENT_COLORS.very_positive
      );
      expect(getSentimentMeasureColor("FeedbackRecords.mixedCount")).toBe(CHART_SENTIMENT_COLORS.mixed);
    });

    test("returns undefined for non-sentiment measures", () => {
      expect(getSentimentMeasureColor("FeedbackRecords.count")).toBeUndefined();
      expect(getSentimentMeasureColor("FeedbackRecords.joyCount")).toBeUndefined();
      expect(getSentimentMeasureColor("FeedbackRecords.sentimentAverage")).toBeUndefined();
    });
  });

  describe("pivotMeasuresToCategories", () => {
    const label = (key: string) => `label:${key}`;

    test("pivots a single measure row into one category row per measure", () => {
      const data = [{ "F.veryPositiveCount": 3, "F.negativeCount": "1" }];
      const result = pivotMeasuresToCategories(data, ["F.veryPositiveCount", "F.negativeCount"], label);
      expect(result).toEqual([
        {
          [PIVOTED_MEASURE_KEY]: "F.veryPositiveCount",
          [PIVOTED_VALUE_KEY]: 3,
          tooltipLabel: "label:F.veryPositiveCount",
          fill: CHART_MEASURE_COLORS[0],
        },
        {
          [PIVOTED_MEASURE_KEY]: "F.negativeCount",
          [PIVOTED_VALUE_KEY]: 1,
          tooltipLabel: "label:F.negativeCount",
          fill: CHART_MEASURE_COLORS[1],
        },
      ]);
    });

    test("keeps the given measure order so bars fill the axis from the left", () => {
      const data = [{ b: 2, a: 1 }];
      const result = pivotMeasuresToCategories(data, ["a", "b"], label);
      expect(result.map((row) => row[PIVOTED_MEASURE_KEY])).toEqual(["a", "b"]);
    });

    test("keeps missing, null, and non-numeric values null so they never read as a measured zero", () => {
      const data = [{ a: null, b: "n/a" }];
      const result = pivotMeasuresToCategories(data, ["a", "b", "missing"], label);
      // A measure Cube computed as NULL (never asked) must not render the same as a real 0.
      expect(result.map((row) => row[PIVOTED_VALUE_KEY])).toEqual([null, null, null]);
    });

    test("distinguishes a genuine zero from a null measure", () => {
      const data = [{ scored: 0, notAsked: null }];
      const result = pivotMeasuresToCategories(data, ["scored", "notAsked"], label);
      expect(result.map((row) => row[PIVOTED_VALUE_KEY])).toEqual([0, null]);
    });

    test("emits one row per measure key when data is empty, with no value", () => {
      const result = pivotMeasuresToCategories([], ["a"], label);
      expect(result).toHaveLength(1);
      expect(result[0][PIVOTED_VALUE_KEY]).toBeNull();
    });

    test("cycles the palette when there are more measures than colors", () => {
      const keys = Array.from({ length: CHART_MEASURE_COLORS.length + 1 }, (_, i) => `m${i}`);
      const result = pivotMeasuresToCategories([{}], keys, label);
      expect(result.at(-1)?.fill).toBe(CHART_MEASURE_COLORS[0]);
    });

    test("sentiment count measures keep their semantic colors and don't consume palette hues", () => {
      const result = pivotMeasuresToCategories(
        [{}],
        ["FeedbackRecords.veryPositiveCount", "FeedbackRecords.count", "FeedbackRecords.mixedCount"],
        label
      );
      expect(result.map((row) => row.fill)).toEqual([
        CHART_SENTIMENT_COLORS.very_positive,
        CHART_MEASURE_COLORS[0],
        CHART_SENTIMENT_COLORS.mixed,
      ]);
    });
  });

  describe("constants", () => {
    test("CHART_MEASURE_COLORS has expected length", () => {
      expect(CHART_MEASURE_COLORS).toHaveLength(8);
      expect(CHART_MEASURE_COLORS[0]).toBe(CHART_BRAND_DARK);
    });

    test("CHART_MEASURE_COLORS has no duplicate hues", () => {
      expect(new Set(CHART_MEASURE_COLORS).size).toBe(CHART_MEASURE_COLORS.length);
    });

    test("CHART_SENTIMENT_COLORS covers every enum value with distinct colors", () => {
      expect(Object.keys(CHART_SENTIMENT_COLORS).sort()).toEqual([...SENTIMENT_VALUE_ORDER].sort());
      const colors = Object.values(CHART_SENTIMENT_COLORS);
      expect(new Set(colors).size).toBe(colors.length);
      // the semantic scale must not collide with the "not enriched" gray
      expect(colors).not.toContain(CHART_NOT_ENRICHED_COLOR);
    });
  });
});

describe("flipped bar axis sizing", () => {
  test("sizes the category gutter to the labels present", () => {
    // Three numeric categories used to leave ~150px of empty gutter before the bars started.
    expect(getCategoryAxisWidth(["3", "10", "25"])).toBeLessThan(CATEGORY_AXIS_MAX_WIDTH / 2);
  });

  test("never drops below the floor or above the ceiling", () => {
    expect(getCategoryAxisWidth(["1"])).toBe(CATEGORY_AXIS_MIN_WIDTH);
    expect(getCategoryAxisWidth([])).toBe(CATEGORY_AXIS_MIN_WIDTH);
    expect(getCategoryAxisWidth(["How satisfied are you with the checkout experience overall?"])).toBe(
      CATEGORY_AXIS_MAX_WIDTH
    );
  });

  test("takes the longest label, not the first or last", () => {
    const width = getCategoryAxisWidth(["ok", "a considerably longer label", "no"]);
    expect(width).toBe(getCategoryAxisWidth(["a considerably longer label"]));
  });

  test("reserves room for the widest value label so the longest bar keeps its number", () => {
    // The bug this guards: with no padding the label of a bar reaching the axis bound is anchored
    // at the plot edge and clipped by the SVG viewport.
    expect(getValueLabelPadding(["50", "20", "5"])).toBeGreaterThanOrEqual(VALUE_LABEL_MIN_PADDING);
    expect(getValueLabelPadding(["1,234,567"])).toBeGreaterThan(getValueLabelPadding(["5"]));
  });

  test("caps the value gutter so a huge number cannot eat the plot", () => {
    expect(getValueLabelPadding(["123,456,789,012,345"])).toBe(VALUE_LABEL_MAX_PADDING);
  });
});

describe("formatPercentShare", () => {
  test("keeps one fraction digit, so a small real share is not rounded away to 0%", () => {
    // 2 records out of 500: the section is drawn and hoverable, so its label must not read "0%".
    expect(formatPercentShare(0.004, "en-US")).toBe("0.4%");
    expect(formatPercentShare(1 / 3, "en-US")).toBe("33.3%");
    expect(formatPercentShare(1, "en-US")).toBe("100.0%");
  });

  test("follows the locale's decimal separator instead of a hardcoded period", () => {
    const de = formatPercentShare(0.125, "de-DE");
    expect(de).toContain("12,5");
    expect(de).not.toContain("12.5");
  });
});
