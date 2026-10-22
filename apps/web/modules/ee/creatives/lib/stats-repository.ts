import "server-only";
import { prisma } from "@formbricks/database";
import type { CreativeDeviceType } from "@formbricks/database/prisma";
import { OTHER_PAGE } from "./stats";

/**
 * The storage boundary of creative counts (ENG-4000): the daily rollup tables, which only the
 * counter flush writes and the v3 `stats` operation reads. Days are `YYYY-MM-DD` strings in UTC
 * throughout, never `Date`s, so no caller can shift one through a local time zone.
 */

export interface TCreativeDayDeviceCount {
  date: string;
  deviceType: CreativeDeviceType;
  impressions: number;
  clicks: number;
}

export interface TCreativePageCount {
  page: string;
  impressions: number;
  clicks: number;
}

/** One day's running totals of one creative, as the Redis counters hold them. */
export type TCreativeDeviceCountRow = TCreativeDayDeviceCount & { creativeId: string };
export type TCreativePageCountRow = TCreativePageCount & { creativeId: string; date: string };

/** Page rows per statement: one creative can bring 1001 per day, and a flush batch many creatives. */
const PAGE_ROWS_PER_STATEMENT = 5_000;

const toUtcDay = (date: Date): string => date.toISOString().slice(0, 10);

export const findCreativeDayDeviceCounts = async (
  creativeId: string,
  workspaceId: string,
  from: string,
  to: string
): Promise<TCreativeDayDeviceCount[]> => {
  const rows = await prisma.creativeDailyStat.findMany({
    where: { creativeId, creative: { workspaceId }, date: { gte: new Date(from), lte: new Date(to) } },
    select: { date: true, deviceType: true, impressions: true, clicks: true },
  });
  return rows.map((row) => ({ ...row, date: toUtcDay(row.date) }));
};

/**
 * Each page's counts summed over the range: the `limit` pages with the most Impressions (then Clicks),
 * and one `(other)` row summing every other page with the pages the counters already put under it.
 */
export const findCreativePageCounts = async (
  creativeId: string,
  workspaceId: string,
  from: string,
  to: string,
  limit: number
): Promise<TCreativePageCount[]> => {
  const rows = await prisma.$queryRaw<{ page: string; impressions: bigint; clicks: bigint }[]>`
    WITH pages AS (
      SELECT stat."page", SUM(stat."impressions") AS impressions, SUM(stat."clicks") AS clicks
      FROM "CreativeDailyPageStat" stat
      JOIN "Creative" creative ON creative."id" = stat."creativeId" AND creative."workspaceId" = ${workspaceId}
      WHERE stat."creativeId" = ${creativeId} AND stat."date" BETWEEN ${from}::date AND ${to}::date
      GROUP BY stat."page"
    ), ranked AS (
      SELECT "page", impressions, clicks,
        ROW_NUMBER() OVER (ORDER BY ("page" = ${OTHER_PAGE}), impressions DESC, clicks DESC, "page") AS rank
      FROM pages
    )
    SELECT CASE WHEN rank <= ${limit} AND "page" <> ${OTHER_PAGE} THEN "page" ELSE ${OTHER_PAGE} END AS page,
      SUM(impressions)::bigint AS impressions, SUM(clicks)::bigint AS clicks
    FROM ranked
    GROUP BY 1
  `;
  return rows.map((row) => ({
    page: row.page,
    impressions: Number(row.impressions),
    clicks: Number(row.clicks),
  }));
};

/**
 * Writes counted running totals as `GREATEST(stored, counted)`: the counters only grow within their day,
 * so a repeated or overlapping flush changes nothing, and a total counted later replaces a smaller one.
 * Rows that wouldn't change are skipped, not rewritten. A creative deleted since it was counted is left
 * out (its counts went with it).
 */
export const upsertCreativeDeviceCounts = async (rows: readonly TCreativeDeviceCountRow[]): Promise<void> => {
  if (rows.length === 0) return;
  await prisma.$executeRaw`
    INSERT INTO "CreativeDailyStat" ("creativeId", "date", "deviceType", "impressions", "clicks")
    SELECT counted."creativeId", counted."date", counted."deviceType", counted."impressions", counted."clicks"
    FROM unnest(
      ${rows.map((row) => row.creativeId)}::text[],
      ${rows.map((row) => row.date)}::date[],
      ${rows.map((row) => row.deviceType)}::text[]::"CreativeDeviceType"[],
      ${rows.map((row) => row.impressions)}::integer[],
      ${rows.map((row) => row.clicks)}::integer[]
    ) AS counted("creativeId", "date", "deviceType", "impressions", "clicks")
    WHERE EXISTS (SELECT 1 FROM "Creative" WHERE "Creative"."id" = counted."creativeId")
    ON CONFLICT ("creativeId", "date", "deviceType") DO UPDATE SET
      "impressions" = GREATEST("CreativeDailyStat"."impressions", EXCLUDED."impressions"),
      "clicks" = GREATEST("CreativeDailyStat"."clicks", EXCLUDED."clicks")
    WHERE EXCLUDED."impressions" > "CreativeDailyStat"."impressions"
      OR EXCLUDED."clicks" > "CreativeDailyStat"."clicks"
  `;
};

/** `upsertCreativeDeviceCounts` for the per-page totals. */
export const upsertCreativePageCounts = async (rows: readonly TCreativePageCountRow[]): Promise<void> => {
  for (let start = 0; start < rows.length; start += PAGE_ROWS_PER_STATEMENT) {
    const chunk = rows.slice(start, start + PAGE_ROWS_PER_STATEMENT);
    await prisma.$executeRaw`
      INSERT INTO "CreativeDailyPageStat" ("creativeId", "date", "page", "impressions", "clicks")
      SELECT counted."creativeId", counted."date", counted."page", counted."impressions", counted."clicks"
      FROM unnest(
        ${chunk.map((row) => row.creativeId)}::text[],
        ${chunk.map((row) => row.date)}::date[],
        ${chunk.map((row) => row.page)}::text[],
        ${chunk.map((row) => row.impressions)}::integer[],
        ${chunk.map((row) => row.clicks)}::integer[]
      ) AS counted("creativeId", "date", "page", "impressions", "clicks")
      WHERE EXISTS (SELECT 1 FROM "Creative" WHERE "Creative"."id" = counted."creativeId")
      ON CONFLICT ("creativeId", "date", "page") DO UPDATE SET
        "impressions" = GREATEST("CreativeDailyPageStat"."impressions", EXCLUDED."impressions"),
        "clicks" = GREATEST("CreativeDailyPageStat"."clicks", EXCLUDED."clicks")
      WHERE EXCLUDED."impressions" > "CreativeDailyPageStat"."impressions"
        OR EXCLUDED."clicks" > "CreativeDailyPageStat"."clicks"
    `;
  }
};
