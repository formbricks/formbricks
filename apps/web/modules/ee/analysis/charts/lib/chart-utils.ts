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
 * sits just under the categorical chroma floor, acceptable for a brand hue. Groundwork for the
 * sentiment-only chart (ENG-1558).
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

/** Validate a chart type string, defaulting to "bar" if unrecognized. */
export const resolveChartType = (raw: string): TChartType => {
  const parsed = ZChartType.safeParse(raw);
  return parsed.success ? parsed.data : "bar";
};

const isNumericValue = (val: TChartDataRow[string]): boolean => {
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
