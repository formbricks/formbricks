import "server-only";
import { claimCountedCreatives, readCreativeCounters, releaseCountedCreatives } from "./counters";
import { toUtcDay } from "./stats";
import { upsertCreativeDeviceCounts, upsertCreativePageCounts } from "./stats-repository";

/**
 * The counter flush (ENG-4000, ADR 0005): copies the running day totals of every creative counted since
 * the last flush from Redis to `CreativeDailyStat` and `CreativeDailyPageStat`. Run every minute by the
 * `creative-stats.flush` job, so counts reach the v3 `stats` operation within about a minute.
 *
 * It writes totals, never increments, as `GREATEST(stored, counted)`: a repeated, failed-and-retried or
 * overlapping flush changes nothing, and events counted after a flush land with the next one. Yesterday
 * is flushed too, so the events of a day's last minute land with the first flush after midnight (UTC).
 */

/** Creatives per claim: one claim's page rows are at most this × 1001. */
export const CREATIVE_FLUSH_BATCH_SIZE = 100;
/** Claims per day per run; a busier minute leaves the rest pending for the next run. */
export const CREATIVE_FLUSH_MAX_BATCHES = 50;

const DAY_MS = 86_400_000;

export interface TCreativeFlushSummary {
  /** Creative-days written; a creative counted on both days counts twice. */
  flushed: number;
}

const flushDay = async (day: string): Promise<number> => {
  let flushed = 0;
  for (let batch = 0; batch < CREATIVE_FLUSH_MAX_BATCHES; batch += 1) {
    const creativeIds = await claimCountedCreatives(day, CREATIVE_FLUSH_BATCH_SIZE);
    if (creativeIds.length === 0) break;

    const { deviceRows, pageRows } = await readCreativeCounters(day, creativeIds);
    await upsertCreativeDeviceCounts(deviceRows);
    await upsertCreativePageCounts(pageRows);
    await releaseCountedCreatives(day, creativeIds);

    flushed += creativeIds.length;
    if (creativeIds.length < CREATIVE_FLUSH_BATCH_SIZE) break;
  }
  return flushed;
};

export const flushCreativeCounters = async (now: Date = new Date()): Promise<TCreativeFlushSummary> => {
  const yesterday = toUtcDay(new Date(now.getTime() - DAY_MS));
  const today = toUtcDay(now);

  let flushed = 0;
  for (const day of [yesterday, today]) {
    flushed += await flushDay(day);
  }
  return { flushed };
};
