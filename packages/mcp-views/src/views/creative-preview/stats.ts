import { type FormatContext, formatNumber } from "../../shared/format";
import { isRecord } from "../../shared/guards";

/** The totals of `get_creative_stats` the panel shows: Impressions, Clicks and the Click rate. */
export interface TCreativeStatsTotals {
  from: string;
  to: string;
  impressions: number;
  clicks: number;
  /** A fraction (`0.05` is 5 %), or `null` without Impressions. */
  clickRate: number | null;
}

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

type TStatsResult = { isError?: boolean; structuredContent?: unknown } | null | undefined;

/** The totals from a stats result, or `undefined` for an error or any other shape. */
export const readCreativeStats = (result: TStatsResult): TCreativeStatsTotals | undefined => {
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

export const formatClickRate = (clickRate: number | null, format: FormatContext = {}): string =>
  clickRate === null
    ? "No impressions"
    : formatNumber(clickRate, format, { style: "percent", maximumFractionDigits: 1 });

/** Stats exist only for a creative that was published at some point. */
export const hasStats = (creative: { displayStatus: string; status: string }): boolean =>
  creative.displayStatus !== "draft" || creative.status !== "draft";

/**
 * The totals of the last 30 days through `get_creative_stats`, or `undefined` when the call failed, threw
 * or answered something else. The view then says the figures are not available here.
 */
export const fetchCreativeStats = async (
  callTool: (name: string, args: Record<string, unknown>) => Promise<TStatsResult>,
  creativeId: string
): Promise<TCreativeStatsTotals | undefined> => {
  try {
    return readCreativeStats(await callTool("get_creative_stats", { creativeId }));
  } catch {
    return undefined;
  }
};
