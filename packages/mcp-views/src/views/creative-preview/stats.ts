import { type TFormatContext, formatNumber } from "./describe";

/** The totals of `get_creative_stats` the panel shows: Impressions, Clicks and the Click rate. */
export interface TCreativeStatsTotals {
  from: string;
  to: string;
  impressions: number;
  clicks: number;
  /** A fraction (`0.05` is 5 %), or `null` without Impressions. */
  clickRate: number | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/** The totals from a stats result, or `undefined` for an error or any other shape. */
export const readCreativeStats = (
  result: { isError?: boolean; structuredContent?: unknown } | null | undefined
): TCreativeStatsTotals | undefined => {
  if (!result || result.isError) return undefined;
  const data = isRecord(result.structuredContent) ? result.structuredContent.data : undefined;
  if (!isRecord(data) || !isRecord(data.totals)) return undefined;
  const { totals, from, to } = data;
  const { impressions, clicks, clickRate } = totals;
  if (typeof from !== "string" || typeof to !== "string" || !isCount(impressions) || !isCount(clicks)) {
    return undefined;
  }
  return { from, to, impressions, clicks, clickRate: isCount(clickRate) ? clickRate : null };
};

export const formatClickRate = (clickRate: number | null, format: TFormatContext = {}): string =>
  clickRate === null
    ? "No impressions"
    : formatNumber(clickRate, format, { style: "percent", maximumFractionDigits: 1 });

/** Stats exist only for a creative that was published at some point. */
export const hasStats = (creative: { displayStatus: string; status: string }): boolean =>
  creative.displayStatus !== "draft" || creative.status !== "draft";
