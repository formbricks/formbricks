import type { CreativeStatsZodType } from "@formbricks/api-v3-schemas";
import type { TCreativeDayDeviceCount, TCreativePageCount } from "./stats-repository";

/**
 * A creative's counts as the v3 `stats` operation returns them (`CreativeStats` in the spec): every UTC
 * day of the range, totals, and the page or device breakdown. Pure; the stored rows come in.
 */

export type TCreativeStats = CreativeStatsZodType;

/** Where a creative's counts go once it has counted 1000 pages in a UTC day, and every unlisted page. */
export const OTHER_PAGE = "(other)";
export type TCreativeStatsGroupBy = "page" | "device";

/** The range a request gets without `from` and `to`: the 30 UTC days up to today. */
export const DEFAULT_STATS_RANGE_DAYS = 30;
/** The longest range one request may ask for: a year, leap day included. */
export const MAX_STATS_RANGE_DAYS = 366;
/** Pages listed by name; the rest are summed into `(other)`. */
export const MAX_STATS_PAGES = 100;

const DEVICE_TYPES = ["phone", "tablet", "desktop"] as const;
const DAY_MS = 86_400_000;

export const toUtcDay = (at: Date): string => at.toISOString().slice(0, 10);

const addDays = (day: string, days: number): string => toUtcDay(new Date(Date.parse(day) + days * DAY_MS));

const daysBetween = (from: string, to: string): number => (Date.parse(to) - Date.parse(from)) / DAY_MS;

export interface TStatsRange {
  from: string;
  to: string;
}

export type TStatsRangeResult =
  | { ok: true; range: TStatsRange }
  | { ok: false; invalidParam: { name: string; reason: string } };

/** `to` defaults to today (UTC) and `from` to 29 days before `to`; both are inclusive. */
export const resolveStatsRange = (query: { from?: string; to?: string }, now: Date): TStatsRangeResult => {
  const to = query.to ?? toUtcDay(now);
  const from = query.from ?? addDays(to, 1 - DEFAULT_STATS_RANGE_DAYS);

  if (from > to) {
    return { ok: false, invalidParam: { name: "from", reason: "`from` must not be after `to`" } };
  }
  if (daysBetween(from, to) + 1 > MAX_STATS_RANGE_DAYS) {
    return {
      ok: false,
      invalidParam: { name: "from", reason: `The range can span at most ${MAX_STATS_RANGE_DAYS} days` },
    };
  }
  return { ok: true, range: { from, to } };
};

const withClickRate = (impressions: number, clicks: number) => ({
  impressions,
  clicks,
  clickRate: impressions > 0 ? clicks / impressions : null,
});

type TSums = { impressions: number; clicks: number };

const addTo = <K>(sums: Map<K, TSums>, key: K, { impressions, clicks }: TSums): void => {
  const sum = sums.get(key) ?? { impressions: 0, clicks: 0 };
  sums.set(key, { impressions: sum.impressions + impressions, clicks: sum.clicks + clicks });
};

/** Most Impressions first, then most Clicks, then by name; `(other)` always last. */
const comparePages = (a: TCreativePageCount, b: TCreativePageCount): number => {
  if ((a.page === OTHER_PAGE) !== (b.page === OTHER_PAGE)) return a.page === OTHER_PAGE ? 1 : -1;
  if (a.impressions !== b.impressions) return b.impressions - a.impressions;
  if (a.clicks !== b.clicks) return b.clicks - a.clicks;
  if (a.page === b.page) return 0;
  return a.page < b.page ? -1 : 1;
};

export const buildCreativeStats = ({
  creativeId,
  range,
  groupBy,
  dayDeviceCounts,
  pageCounts,
}: {
  creativeId: string;
  range: TStatsRange;
  groupBy: TCreativeStatsGroupBy | null;
  dayDeviceCounts: readonly TCreativeDayDeviceCount[];
  /** Only read with `groupBy: "page"`. */
  pageCounts: readonly TCreativePageCount[];
}): TCreativeStats => {
  const byDay = new Map<string, TSums>();
  const byDevice = new Map<string, TSums>();
  for (const row of dayDeviceCounts) {
    addTo(byDay, row.date, row);
    addTo(byDevice, row.deviceType, row);
  }

  const days: TCreativeStats["days"] = [];
  const totals = { impressions: 0, clicks: 0 };
  for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
    const { impressions, clicks } = byDay.get(date) ?? { impressions: 0, clicks: 0 };
    totals.impressions += impressions;
    totals.clicks += clicks;
    days.push({ date, ...withClickRate(impressions, clicks) });
  }

  return {
    creativeId,
    from: range.from,
    to: range.to,
    groupBy,
    totals: withClickRate(totals.impressions, totals.clicks),
    days,
    ...(groupBy === "device" && {
      devices: DEVICE_TYPES.map((deviceType) => {
        const { impressions, clicks } = byDevice.get(deviceType) ?? { impressions: 0, clicks: 0 };
        return { deviceType, ...withClickRate(impressions, clicks) };
      }),
    }),
    ...(groupBy === "page" && {
      pages: [...pageCounts]
        .sort(comparePages)
        .map(({ page, impressions, clicks }) => ({ page, ...withClickRate(impressions, clicks) })),
    }),
  };
};
