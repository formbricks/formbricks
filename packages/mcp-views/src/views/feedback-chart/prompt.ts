import { type FormatContext, formatCalendarDate } from "./format";
import type { Granularity } from "./model";

/** Text the view composes from query and chart data: the follow-up message and the subtitle. */

const FINER: Record<Granularity, Granularity | undefined> = {
  year: "month",
  quarter: "month",
  month: "week",
  week: "day",
  day: "hour",
  hour: undefined,
};

/**
 * Chart data is feedback, which is untrusted text: one line, bounded, no quotes that could close the
 * quoted value early.
 */
const cleanValue = (value: string, max = 80): string => {
  const flat = value.replace(/["“”]/g, "'").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

export interface DigDeeperTarget {
  chartTitle: string;
  /** Label of the x field and the text of the clicked value. */
  xLabel: string;
  xValue: string;
  granularity?: Granularity;
  /** Label of the series field and the clicked series, when the chart has one. */
  seriesLabel?: string;
  seriesValue?: string;
  measureLabel: string;
  valueText: string;
}

/**
 * The message the person can send to the agent from a selected point. It asks and names; it does not tell
 * the agent which tool to call, and nothing is sent until the person presses the button.
 */
export const buildDigDeeperPrompt = (target: DigDeeperTarget): string => {
  const parts = [`${cleanValue(target.xLabel)}: "${cleanValue(target.xValue)}"`];
  if (target.seriesLabel && target.seriesValue) {
    parts.push(`${cleanValue(target.seriesLabel)}: "${cleanValue(target.seriesValue)}"`);
  }
  const where = parts.join(", ");
  const finer = target.granularity ? FINER[target.granularity] : undefined;
  const ask = finer
    ? `Break it down further by ${finer}, and tell me what stands out.`
    : "Break it down further, and tell me what is behind it.";
  return `In "${cleanValue(target.chartTitle, 100)}", look closer at ${where} (${cleanValue(target.measureLabel)}: ${cleanValue(target.valueText, 30)}). ${ask}`;
};

type QueryLike = Record<string, unknown> | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** "Last 30 days", "Jan 1, 2026 to Jan 31, 2026", "2 filters": what the query was scoped to. */
export const describeScope = (query: QueryLike, context: FormatContext = {}): string[] => {
  const parts: string[] = [];
  const timeDimensions: unknown = query?.timeDimensions;
  const timeDimension: unknown = Array.isArray(timeDimensions) ? (timeDimensions as unknown[])[0] : undefined;
  if (isRecord(timeDimension)) {
    const range = timeDimension.dateRange;
    if (typeof range === "string") {
      parts.push(range.charAt(0).toUpperCase() + range.slice(1));
    } else if (
      Array.isArray(range) &&
      range.length === 2 &&
      range.every((item) => typeof item === "string")
    ) {
      parts.push(`${formatCalendarDate(range[0], context)} to ${formatCalendarDate(range[1], context)}`);
    }
  }
  const filters = Array.isArray(query?.filters) ? query.filters.length : 0;
  if (filters > 0) parts.push(`${filters} ${filters === 1 ? "filter" : "filters"}`);
  return parts;
};
