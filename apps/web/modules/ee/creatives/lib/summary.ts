import { addDays, max, min } from "date-fns";
import type { CreativeStatsDayZodType } from "@formbricks/api-v3-schemas";
import {
  DATE_RANGE_PRESETS,
  type TDateRangePreset,
  getCalendarDayInTimeZone,
  isSubDayDateRangePreset,
  resolveDateRangePreset,
} from "@/lib/date-ranges";
import { formatDateForDisplay, formatLocalDay, parseLocalDay } from "@/lib/utils/datetime";
import { type TCreativesAccess, type TCreativesOperation, isCreativesOperationAllowed } from "./access-rules";
import type { TCreativeDisplayStatus, TCreativeDisplayStatusReason, TCreativeStatus } from "./display-status";
import { MAX_STATS_RANGE_DAYS, type TStatsRange } from "./stats";

// What the creative summary page derives from its state and the stats response. Counts are stored per
// UTC day (the server's receive time), so every range here is cut in UTC days, whatever zone the viewer
// or the organization is in: a day the page names is the day the API counted.

const STATS_TIME_ZONE = "UTC";

/** The shared date presets that span whole days; counts have no time of day, so "last 24 hours" can't apply. */
export type TCreativeStatsPreset = Exclude<TDateRangePreset, "last 24 hours">;

export const CREATIVE_STATS_PRESETS = DATE_RANGE_PRESETS.filter(
  (preset): preset is TCreativeStatsPreset => !isSubDayDateRangePreset(preset)
);

/** A preset, or calendar days picked by hand (date-only values, as the calendar emits them). */
export type TCreativeStatsRangeSelection =
  | { preset: TCreativeStatsPreset }
  | { preset: null; from: Date; to: Date };

/** Today's UTC day as a date-only value: the last day anything can have been counted on. */
export const getStatsToday = (now: Date): Date => getCalendarDayInTimeZone(now, STATS_TIME_ZONE);

/**
 * The UTC days the selection covers, as the API spells them. A hand-picked range ends today at the
 * latest and keeps its latest `MAX_STATS_RANGE_DAYS` days, so it is always one the API accepts.
 */
export const resolveCreativeStatsRange = (
  selection: TCreativeStatsRangeSelection,
  now: Date
): TStatsRange => {
  const today = getStatsToday(now);
  const [start, end] =
    selection.preset === null
      ? [selection.from, selection.to]
      : (resolveDateRangePreset(selection.preset, STATS_TIME_ZONE, now) ?? [today, today]);
  const to = min([end, today]);
  const from = min([max([start, addDays(to, 1 - MAX_STATS_RANGE_DAYS)]), to]);
  return { from: formatLocalDay(from), to: formatLocalDay(to) };
};

export const buildCreativeStatsSearchParams = (
  selection: TCreativeStatsRangeSelection,
  now: Date
): URLSearchParams => {
  const { from, to } = resolveCreativeStatsRange(selection, now);
  return new URLSearchParams({ from, to, groupBy: "page" });
};

/** Where a rate is missing (no Impressions), as the survey summary's cards show an empty value. */
export const NO_VALUE = "-";

export const formatCount = (count: number, locale: string): string =>
  new Intl.NumberFormat(locale).format(count);

/**
 * Click rate (a fraction from the API) as a percentage to one decimal. A rate that rounds to zero but
 * isn't zero reads "<0.1%", so a few Clicks on many Impressions never look like none.
 */
export const formatClickRate = (rate: number | null, locale: string): string => {
  if (rate === null) return NO_VALUE;
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const formatted = percent.format(rate);
  return rate > 0 && formatted === percent.format(0) ? `<${percent.format(0.001)}` : formatted;
};

const DAY_LABEL_OPTIONS: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

/**
 * A `yyyy-MM-dd` day as the page shows it ("Oct 15"). Parsed to local midnight, so it reads as that day
 * in any zone; `new Date(day)` would be UTC midnight and show the day before west of UTC.
 */
export const formatStatsDay = (day: string, locale: string): string =>
  formatDateForDisplay(parseLocalDay(day), locale, DAY_LABEL_OPTIONS);

/** The UTC days a range covers, shown next to the preset's name so the window behind the numbers is visible. */
export const formatStatsRange = ({ from, to }: TStatsRange, locale: string): string =>
  from === to
    ? formatStatsDay(from, locale)
    : `${formatStatsDay(from, locale)} – ${formatStatsDay(to, locale)}`;

export interface TDailyChartRow {
  date: string;
  label: string;
  impressions: number;
  clicks: number;
}

export const toDailyChartRows = (days: CreativeStatsDayZodType[], locale: string): TDailyChartRow[] =>
  days.map(({ date, impressions, clicks }) => ({
    date,
    label: formatStatsDay(date, locale),
    impressions,
    clicks,
  }));

/** The statuses an author picks on the summary: Active, Paused and Closed. */
export type TSummaryStatus = Exclude<TCreativeStatus, "draft">;

export type TSummaryStatusControl =
  | { kind: "select"; value: TSummaryStatus; options: readonly TSummaryStatus[] }
  | { kind: "pill" };

// Setting a status is a pause or a close, which wind-down allows, or turning the creative back on.
const STATUS_OPERATION: Record<TSummaryStatus, TCreativesOperation> = {
  inProgress: "update",
  paused: "pause",
  completed: "close",
};

const SUMMARY_STATUSES: readonly TSummaryStatus[] = ["inProgress", "paused", "completed"];

/**
 * How the summary and editor headers show the status. Writers switch a published creative between
 * Active, Paused and Closed, like a survey's status dropdown; a draft is published with the editor's
 * Publish (which checks it first), an archived creative can't change, and read-only members only see
 * where it stands. In wind-down the menu only pauses or closes it (ENG-6602).
 */
export const getSummaryStatusControl = (
  creative: { status: TCreativeStatus; archivedAt: string | null },
  isReadOnly: boolean,
  access: TCreativesAccess
): TSummaryStatusControl => {
  if (isReadOnly || creative.archivedAt !== null || creative.status === "draft") return { kind: "pill" };
  const options = SUMMARY_STATUSES.filter((status) =>
    isCreativesOperationAllowed(access, STATUS_OPERATION[status])
  );
  if (options.length === 0) return { kind: "pill" };
  return { kind: "select", value: creative.status, options };
};

/** Whether turning the creative on would only schedule it: its start is still ahead. */
export const isWaitingForStart = (schedule: { startAt: string | null }, now: Date): boolean =>
  schedule.startAt !== null && new Date(schedule.startAt).getTime() > now.getTime();

export type TRowStatusAction =
  | { action: "publish" }
  | { action: "pause" | "keepPaused" | "close"; status: Exclude<TSummaryStatus, "inProgress"> }
  | { action: "resume" | "reopen"; status: "inProgress" };

const ROW_ACTION_OPERATION: Record<TRowStatusAction["action"], TCreativesOperation> = {
  publish: "update",
  pause: "pause",
  keepPaused: "pause",
  close: "close",
  resume: "update",
  reopen: "update",
};

const getAuthorRowStatusActions = (creative: {
  status: TCreativeStatus;
  displayStatus: TCreativeDisplayStatus;
  archivedAt: string | null;
}): TRowStatusAction[] => {
  if (creative.archivedAt !== null) return [];
  const close = { action: "close", status: "completed" } as const;
  switch (creative.status) {
    case "draft":
      return [{ action: "publish" }];
    case "inProgress":
      return [
        { action: creative.displayStatus === "paused" ? "keepPaused" : "pause", status: "paused" },
        close,
      ];
    case "paused":
      return [{ action: "resume", status: "inProgress" }, close];
    case "completed":
      return [{ action: "reopen", status: "inProgress" }];
  }
};

/**
 * The status items of a list row's menu, from the author's status. A draft's Publish opens the editor,
 * since publishing checks it first; an archived creative has none. Read-only members get no menu at all.
 * A live creative that shows Paused only because of its survey (or a missing Destination or action) is
 * offered "Keep paused": the same pause, worded for a row that already reads Paused, so it stays paused
 * when the reason goes away. In wind-down only the pause and the close are left (ENG-6602).
 */
export const getRowStatusActions = (
  creative: {
    status: TCreativeStatus;
    displayStatus: TCreativeDisplayStatus;
    archivedAt: string | null;
  },
  access: TCreativesAccess
): TRowStatusAction[] =>
  getAuthorRowStatusActions(creative).filter((item) =>
    isCreativesOperationAllowed(access, ROW_ACTION_OPERATION[item.action])
  );

/** What a published creative can show while its author's status is Active, Paused or Closed. */
export type TSummaryDisplayStatus = Extract<
  TCreativeDisplayStatus,
  "active" | "scheduled" | "paused" | "closed"
>;

const SHOWN_AFTER: Record<TSummaryStatus, readonly TSummaryDisplayStatus[]> = {
  inProgress: ["active", "scheduled"],
  paused: ["paused"],
  completed: ["closed"],
};

export type TStatusChangeOutcome =
  | { kind: "success"; message: TSummaryDisplayStatus }
  | { kind: "notice"; message: NonNullable<TCreativeDisplayStatusReason> };

/**
 * What to tell the author after a status change, from what the creative now shows. The schedule and the
 * Destination survey still have their say: reopening a creative whose end has passed leaves it Closed,
 * and resuming one whose survey isn't active leaves it Paused, so those get the reason, not a confirmation.
 */
export const getStatusChangeOutcome = (
  requested: TSummaryStatus,
  result: { displayStatus: TCreativeDisplayStatus; displayStatusReason: TCreativeDisplayStatusReason }
): TStatusChangeOutcome => {
  const shown = SHOWN_AFTER[requested].find((status) => status === result.displayStatus);
  if (shown) return { kind: "success", message: shown };
  if (result.displayStatusReason) return { kind: "notice", message: result.displayStatusReason };
  return { kind: "success", message: SHOWN_AFTER[requested][0] };
};
