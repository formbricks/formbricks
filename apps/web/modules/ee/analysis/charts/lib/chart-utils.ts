import { format, isValid, parseISO } from "date-fns";
import {
  SENTIMENT_DIMENSION_ID,
  type TSentimentValue,
  getSentimentValueForMeasureId,
  isNotEnrichedDimensionValue,
  isSentimentValue,
} from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";
import { ZChartType } from "@/modules/ee/analysis/types/analysis";

export const CHART_BRAND_DARK = "#00C4B8";
export const CHART_BRAND_LIGHT = "#00E6CA";

/**
 * Shared categorical palette for bar cells, pie slices, and multi-measure series. Assigned by index
 * (never cycled for meaning). Eight distinct hues, ordered to maximize adjacent colorblind
 * separation — validated with the dataviz palette script (worst adjacent CVD ΔE ≈ 38 on white, well
 * above the ≥12 target). The previous 6-hue set repeated teal (#00C4B8 vs #14b8a6) and blue/violet,
 * which collided on the 6-category emotion/sentiment charts.
 */
export const CHART_MEASURE_COLORS = [
  CHART_BRAND_DARK, // teal (brand)
  "#2a78d6", // blue
  "#eda100", // yellow
  "#e34948", // red
  "#4a3aa7", // violet
  "#eb6834", // orange
  "#e87ba4", // magenta
  "#008300", // green
];

/** Neutral gray for the "not enriched" bucket (empty sentiment/emotion values). A true gray (no
 * slate blue cast) that reads as muted in both light and dark so it doesn't compete with the
 * categorical palette. */
export const CHART_NOT_ENRICHED_COLOR = "#a3a3a3"; // neutral-400

/**
 * Semantic scale for sentiment buckets, keyed by enum value (never by series index) so each bucket
 * keeps its color regardless of which buckets appear. Hues deliberately mirror the emotion chart,
 * where the six emotion count measures take CHART_MEASURE_COLORS in EMOTION_MEASURE_ORDER: very
 * negative = sadness red, negative = disgust orange, neutral = surprise blue, mixed = anger
 * yellow; positive is the brand teal and very positive the next-darker brand step
 * (--color-brandnew in globals.css). Validated with the dataviz palette script on white: lightness
 * band and adjacent-pair CVD separation pass (worst adjacent ΔE 16.2, deutan); the dark brand teal
 * sits just under the categorical chroma floor, acceptable for a brand hue.
 */
export const CHART_SENTIMENT_COLORS: Record<TSentimentValue, string> = {
  very_negative: "#e34948", // red (palette red — sadness)
  negative: "#eb6834", // orange (palette orange — disgust)
  neutral: "#2a78d6", // blue (palette blue — surprise)
  positive: CHART_BRAND_DARK, // teal (brand)
  very_positive: "#038178", // dark teal (brand, one step darker)
  mixed: "#eda100", // yellow (palette yellow — anger)
};

/**
 * Semantic color for an enum dimension value: gray for the "not enriched" bucket, the sentiment
 * scale for sentiment values. Returns undefined when the value has no semantic color (other
 * dimensions, unknown tokens) so callers fall back to the generic palette.
 */
export const getSemanticDimensionColor = (dimensionId: string, value: unknown): string | undefined => {
  if (isNotEnrichedDimensionValue(dimensionId, value)) return CHART_NOT_ENRICHED_COLOR;
  if (dimensionId === SENTIMENT_DIMENSION_ID && typeof value === "string" && isSentimentValue(value)) {
    return CHART_SENTIMENT_COLORS[value];
  }
  return undefined;
};

/** Semantic series color for the sentiment count measures (e.g. "FeedbackRecords.veryPositiveCount"),
 * matching the dimension buckets. Undefined for every other measure. */
export const getSentimentMeasureColor = (measureId: string): string | undefined => {
  const value = getSentimentValueForMeasureId(measureId);
  return value ? CHART_SENTIMENT_COLORS[value] : undefined;
};

/**
 * Chart types that no longer exist, mapped to the type that replaced them. `line` merged into
 * `area` as the `areaDisplay: "line"` style, so anything still holding the old value — an AI
 * response, a cached payload — lands on the merged type instead of the "bar" fallback. The
 * display style is not recovered here; the migration is what carries it for stored charts.
 */
const LEGACY_CHART_TYPE_ALIASES: Record<string, TChartType> = { line: "area" };

/** Validate a chart type string, mapping retired types forward and defaulting to "bar". */
export const resolveChartType = (raw: string): TChartType => {
  const parsed = ZChartType.safeParse(raw);
  if (parsed.success) return parsed.data;
  return LEGACY_CHART_TYPE_ALIASES[raw] ?? "bar";
};

const isNumericValue = (val: unknown): boolean => {
  if (val === null || val === undefined || val === "") return false;
  const num = Number(val);
  return !Number.isNaN(num) && Number.isFinite(num);
};

export const preparePieData = (
  data: TChartDataRow[],
  dataKey: string,
  nameKey?: string
): { processedData: TChartDataRow[]; colors: string[] } | null => {
  // Drop zero-value rows alongside non-numeric ones. With `minAngle={2}` on
  // `<Pie>`, a `value: 0` slice gets stretched to 2° of visible arc and the
  // label math (driven by midAngle) then implies a non-zero share, so callouts
  // line up off the data. Trade-off: real "0" categories (e.g. a Neutral
  // sentiment bucket with no responses) disappear from both the pie and the
  // legend; surfacing those in the legend is tracked as a follow-up.
  const validData = data.filter((row) => isNumericValue(row[dataKey]) && Number(row[dataKey]) > 0);
  const processedData = validData
    .map((row) => ({ ...row, [dataKey]: Number(row[dataKey]) }))
    .sort((a, b) => Number(b[dataKey]) - Number(a[dataKey]));
  if (processedData.length === 0) return null;

  // Semantic slices (the gray "not enriched" bucket, the sentiment scale) keep their meaning-bound
  // colors; palette colors are handed out only to the remaining slices so a semantic bucket doesn't
  // consume a categorical hue.
  let paletteIndex = 0;
  const colors = processedData.map((row) => {
    const semanticColor = nameKey ? getSemanticDimensionColor(nameKey, row[nameKey]) : undefined;
    if (semanticColor) return semanticColor;
    const color = CHART_MEASURE_COLORS[paletteIndex % CHART_MEASURE_COLORS.length];
    paletteIndex++;
    return color;
  });
  return { processedData, colors };
};

export const PIE_MEASURE_NAME_KEY = "__measureName";
export const PIE_MEASURE_VALUE_KEY = "__measureValue";

/**
 * Pivot several measures (one/few rows, N measure columns) into one row per measure, so a pie
 * chart with multiple measures and no dimension renders a slice per measure instead of only the
 * first one. Each measure is summed across the given rows.
 *
 * The measure label is stored a second time as `tooltipLabel` because the tooltip keys its row
 * label off the dataKey, which here is the internal PIE_MEASURE_VALUE_KEY rather than a Cube
 * column — without it the tooltip prettifies that key and shows "__measure Value" (ENG-2346).
 */
export const prepareMeasureSliceData = (
  rows: TChartDataRow[],
  measureKeys: string[],
  labelFor: (key: string) => string
): TChartDataRow[] =>
  measureKeys.map((key) => ({
    [PIE_MEASURE_NAME_KEY]: labelFor(key),
    [PIE_MEASURE_VALUE_KEY]: rows.reduce(
      (sum, row) => sum + (isNumericValue(row[key]) ? Number(row[key]) : 0),
      0
    ),
    tooltipLabel: labelFor(key),
  }));

/**
 * Format a 0-1 share as a percentage for display, in the app's active language. One fraction digit
 * throughout: whole percents print a real 0.4% group as "0%" and make three equal groups add up to
 * 99%, and the pie's slice labels and the breakdown bar's legend must agree to the digit, since
 * they are two displays of one chart.
 *
 * `Intl` rather than `toFixed` so the decimal separator and the percent sign follow the locale
 * ("12,5 %" in de-DE), which a hardcoded "%" suffix cannot do.
 */
export const formatPercentShare = (percent: number, locale?: string): string =>
  new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(percent);

/** One section of the single-bar distribution chart (a pie chart's "Breakdown bars" display). */
export interface TDistributionSegment {
  /** Stable react key: the dimension value or the measure id the segment came from. */
  key: string;
  label: string;
  value: number;
  /** Share of the total, 0-1. */
  percent: number;
  color: string;
}

/** Input to {@link buildDistributionSegments}: one candidate section, color optional. */
export interface TDistributionEntry {
  key: string;
  label: string;
  value: unknown;
  /** Meaning-bound color (sentiment scale, "not enriched" gray); palette color when absent. */
  color?: string;
}

/**
 * Turn labelled values into the sections of a single 100% bar: coerce to numbers, compute each
 * section's share, and hand out palette colors to the entries that carry no semantic color (so a
 * semantic bucket never consumes a categorical hue, as in preparePieData).
 *
 * Zero and negative entries are dropped: they would render as a zero-width, unhoverable section.
 * Sections are ordered largest share first, the order and therefore the palette handout
 * preparePieData uses, so switching a pie between its two displays doesn't move or recolour a
 * group. Sorting is stable, so equal shares keep the caller's order. Returns null when nothing is
 * left to show, i.e. the total is not positive.
 */
export function buildDistributionSegments(
  entries: readonly TDistributionEntry[]
): { segments: TDistributionSegment[]; total: number } | null {
  let paletteIndex = 0;
  const scaled = entries
    .map((entry) => ({
      key: entry.key,
      label: entry.label,
      value: isNumericValue(entry.value) ? Number(entry.value) : 0,
      color: entry.color,
    }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = scaled.reduce((sum, entry) => sum + entry.value, 0);
  if (total <= 0) return null;

  const segments = scaled.map(({ key, label, value, color }) => {
    let resolvedColor = color;
    if (!resolvedColor) {
      resolvedColor = CHART_MEASURE_COLORS[paletteIndex % CHART_MEASURE_COLORS.length];
      paletteIndex++;
    }
    return { key, label, value, percent: value / total, color: resolvedColor };
  });

  return { segments, total };
}

/** Category key for rows produced by {@link pivotMeasuresToCategories}. */
export const PIVOTED_MEASURE_KEY = "measure";
/** Value key for rows produced by {@link pivotMeasuresToCategories}. */
export const PIVOTED_VALUE_KEY = "value";

/**
 * Pivot a measure-only result row (one row with one column per measure) into one category row
 * per measure. Rendering the raw row as N bar series leaves recharts with a single category
 * band centered in the plot — a wide empty gap before the first bar. Pivoted, the measures
 * become ordinary categories that fill the x-axis from the left.
 *
 * Missing/non-numeric values stay null: the measure keeps its slot on the axis, but renders as a
 * gap rather than as a zero-height bar labelled 0.
 * `formatLabel` supplies the translated measure label stored as `tooltipLabel` on each row.
 */
export function pivotMeasuresToCategories(
  data: TChartDataRow[],
  measureKeys: string[],
  formatLabel: (measureKey: string) => string
): TChartDataRow[] {
  const row = data[0] ?? {};
  // Like preparePieData: semantic buckets (sentiment counts) keep their meaning-bound colors and
  // don't consume a categorical hue; the palette is handed out only to the remaining measures.
  let paletteIndex = 0;
  return measureKeys.map((key) => {
    const num = Number(row[key]);
    let fill = getSentimentMeasureColor(key);
    if (!fill) {
      fill = CHART_MEASURE_COLORS[paletteIndex % CHART_MEASURE_COLORS.length];
      paletteIndex++;
    }
    return {
      // A measure that computed to NULL stays null: recharts leaves a gap and the value label
      // renders empty, so "not asked" no longer looks like a measured zero.
      [PIVOTED_VALUE_KEY]: isNumericValue(row[key]) && Number.isFinite(num) ? num : null,
      [PIVOTED_MEASURE_KEY]: key,
      tooltipLabel: formatLabel(key),
      fill,
    };
  });
}

// parseISO accepts year-only inputs (e.g. "1000" → Jan 1, 1000); require a
// full YYYY-MM-DD prefix so numeric category labels aren't formatted as dates.
const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

const isLikelyIsoDateString = (str: string): boolean => ISO_DATE_PREFIX.test(str);

/** Format a value for x-axis ticks; ISO date strings become "MMM d, yyyy", others pass through. */
export function formatXAxisTick(value: unknown): string {
  if (value == null) return "";
  let str: string;
  if (typeof value === "string") str = value;
  else if (typeof value === "number") str = String(value);
  else return "";
  if (!isLikelyIsoDateString(str)) return str;
  const date = parseISO(str);
  if (isValid(date)) return format(date, "MMM d, yyyy");
  return str;
}

/**
 * Format a cell value for display in tables and tooltips.
 * ISO date strings become "MMM d, yyyy"; numbers stay as-is (formatted); objects are stringified.
 */
export function formatCellValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (typeof value === "string") {
    if (!isLikelyIsoDateString(value)) return value;
    const date = parseISO(value);
    if (isValid(date)) return format(date, "MMM d, yyyy");
    return value;
  }
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean" || typeof value === "bigint") return String(value);
  return "";
}

// ── Flipped (horizontal) bar chart axis sizing ────────────────────────────────
// Both of these size a gutter to the text that will actually sit in it, rather than claiming a flat
// maximum: a flat gutter reads as a broken layout when the labels are short (three numeric
// categories left ~150px of empty space before the bars started).

/** Approximate advance width (px) of one character at `text-xs`. Errs wide on purpose:
 * over-estimating leaves a little slack, under-estimating clips or wraps text that had room. */
const AXIS_CHAR_WIDTH = 6.5;
/** Gap (px) between a tick's text and the axis line. */
const AXIS_TICK_GAP = 8;

/** Ceiling (px) for the category gutter: wide enough for a short question label, capped so the bars
 * keep most of the plot. Longer labels wrap inside it. */
export const CATEGORY_AXIS_MAX_WIDTH = 160;
/** Floor (px), so a one-character label still has a readable gutter. */
export const CATEGORY_AXIS_MIN_WIDTH = 28;

/** Width (px) for the left-hand category gutter of a flipped bar chart, from the labels present. */
export const getCategoryAxisWidth = (labels: string[]): number => {
  const longest = labels.reduce((max, label) => Math.max(max, label.length), 0);
  const needed = Math.ceil(longest * AXIS_CHAR_WIDTH) + AXIS_TICK_GAP * 2;
  return Math.min(CATEGORY_AXIS_MAX_WIDTH, Math.max(CATEGORY_AXIS_MIN_WIDTH, needed));
};

/** Ceiling (px) for the value-label gutter — enough for a grouped number like "1,234,567". */
export const VALUE_LABEL_MAX_PADDING = 72;
/** Floor (px): a single digit still needs the label to clear the bar's end. */
export const VALUE_LABEL_MIN_PADDING = 14;

/**
 * Room (px) to reserve past the end of the value axis on a flipped bar chart, so the label of the
 * longest bar stays inside the SVG.
 *
 * A vertical chart gets this from the y-axis `padding.top`; flipped, the label moves to the right of
 * the bar's end with nothing holding space for it. Whenever the data max lands exactly on the axis
 * bound — which the "nice" scale produces routinely, since 10/20/50/100 are all multiples of their
 * step — the label of the biggest bar, the one read first, was clipped away entirely.
 */
export const getValueLabelPadding = (labels: string[]): number => {
  const longest = labels.reduce((max, label) => Math.max(max, label.length), 0);
  const needed = Math.ceil(longest * AXIS_CHAR_WIDTH) + AXIS_TICK_GAP;
  return Math.min(VALUE_LABEL_MAX_PADDING, Math.max(VALUE_LABEL_MIN_PADDING, needed));
};
