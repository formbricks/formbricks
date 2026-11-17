import { getFieldById } from "@/modules/ee/analysis/lib/schema-definition";

/**
 * How a measure's numbers read. Fixed per measure — there is no per-chart override — so the same
 * measure prints the same way on a tile, a bar label, a tooltip and an axis.
 *
 * - `integer`: NPS score, a whole number on −100…100 ("−18", never "−18.07").
 * - `percent`: CSAT score, stored as 0…100 and printed as a share ("58 %" in de-DE, "58%" in en-US).
 * - `decimal`: averages, one decimal ("3,5").
 * - `count`: record counts, whole numbers with the locale's thousands separator ("1,234").
 * - `default`: anything we know nothing about, e.g. a measure on an imported field — up to two
 *   decimals, grouped, so nothing is rounded away that the reader may need.
 */
export type TMeasureFormat = "integer" | "percent" | "decimal" | "count" | "default";

const PERCENT_SCORE_MEASURES = new Set(["FeedbackRecords.csatScore"]);
const INTEGER_SCORE_MEASURES = new Set(["FeedbackRecords.npsScore"]);

export const getMeasureFormat = (measureId: string | undefined): TMeasureFormat => {
  if (!measureId) return "default";
  if (PERCENT_SCORE_MEASURES.has(measureId)) return "percent";
  if (INTEGER_SCORE_MEASURES.has(measureId)) return "integer";
  const field = getFieldById(measureId);
  if (!field || !("group" in field)) return "default";
  if (field.group === "average") return "decimal";
  if (field.group === "count") return "count";
  return "default";
};

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const formatterCache = new Map<string, Intl.NumberFormat>();
const getFormatter = (locale: string | undefined, format: TMeasureFormat): Intl.NumberFormat => {
  const cacheKey = `${locale ?? ""}|${format}`;
  let formatter = formatterCache.get(cacheKey);
  if (!formatter) {
    const optionsByFormat: Record<TMeasureFormat, Intl.NumberFormatOptions> = {
      integer: { maximumFractionDigits: 0 },
      percent: { style: "percent", maximumFractionDigits: 0 },
      decimal: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
      count: { maximumFractionDigits: 0 },
      default: { maximumFractionDigits: 2 },
    };
    const options = optionsByFormat[format];
    // "negative": a small negative NPS that rounds to zero prints "0", not "-0".
    const withSign: Intl.NumberFormatOptions = { ...options, signDisplay: "negative" };
    try {
      formatter = new Intl.NumberFormat(locale, withSign);
    } catch {
      // An unknown locale tag falls back to the runtime default rather than breaking the chart.
      formatter = new Intl.NumberFormat(undefined, withSign);
    }
    formatterCache.set(cacheKey, formatter);
  }
  return formatter;
};

/**
 * Prints a measure value in the app's locale, per {@link getMeasureFormat}. Returns "" for a missing
 * value (null, undefined, non-numeric) so callers decide what an absent value looks like.
 */
export const formatMeasureValue = (
  measureId: string | undefined,
  value: unknown,
  locale: string | undefined
): string => {
  const num = toFiniteNumber(value);
  if (num === null) return "";
  const format = getMeasureFormat(measureId);
  const formatter = getFormatter(locale, format);
  return formatter.format(format === "percent" ? num / 100 : num);
};

/**
 * The single format an axis can use when every series on it shares one, so the y-axis of a CSAT
 * score chart reads in percent; mixed series keep the default.
 */
export const getSharedMeasureFormatId = (measureIds: readonly string[]): string | undefined => {
  const formats = new Set(measureIds.map(getMeasureFormat));
  return formats.size === 1 ? measureIds[0] : undefined;
};

/**
 * A value-axis tick for a measure: the measure's format, except that an average's axis drops the
 * forced decimal — ticks land on round numbers, and "1.0, 2.0, 3.0" only adds noise — and a whole-number
 * measure keeps a fractional tick's fraction, so two gridlines never read the same.
 */
export const formatMeasureAxisTick = (
  measureId: string | undefined,
  value: unknown,
  locale: string | undefined
): string => {
  const format = getMeasureFormat(measureId);
  if (format === "decimal") return formatMeasureValue(undefined, value, locale);
  // A count axis over a small range ticks between whole numbers (1, 1.2, 1.4…); rounding those would
  // print the same count on several gridlines, so a fractional tick keeps its fraction.
  if ((format === "count" || format === "integer") && !Number.isInteger(Number(value))) {
    return formatMeasureValue(undefined, value, locale);
  }
  return formatMeasureValue(measureId, value, locale);
};
