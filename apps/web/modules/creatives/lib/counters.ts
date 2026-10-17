import "server-only";
import type { RedisClientType } from "redis";
import { createCacheKey } from "@formbricks/cache";
import {
  SHOW_CONDITION_DEVICE_TYPES,
  type TShowConditionDeviceType,
} from "@formbricks/types/show-conditions";
import { cache } from "@/lib/cache";
import { OTHER_PAGE, toUtcDay } from "./stats";
import type { TCreativeDeviceCountRow, TCreativePageCountRow } from "./stats-repository";

/**
 * The Redis half of creative counting (ENG-4000, ADR 0005). Each UTC day of each creative has two hashes
 * of running totals: per device type and per page. One Lua call per events request increments them all,
 * so concurrent requests never lose an update and the page cap holds exactly. A per-day `pending` set
 * names the creatives with totals the flush job hasn't copied to Postgres yet.
 *
 * Hash fields are `impressions:<x>` and `clicks:<x>`, where `<x>` is a device type or a page; the pages
 * hash also keeps `pages`, the number of pages it has admitted. A page always contains `/` after its
 * host, so no page can be named `pages` or `(other)`.
 *
 * Every key expires about two days after it is created, which outlives the day it counts plus the first
 * flush after midnight. That matters: Valkey runs `noeviction`, so a counter nobody expires is memory
 * nobody gets back, and an instance without the BullMQ worker never drains the pending sets.
 */

export const CREATIVE_COUNTER_TTL_SECONDS = 48 * 60 * 60;
export const MAX_COUNTED_PAGES_PER_DAY = 1000;

export interface TCreativeEventCounts {
  page: string;
  deviceType: TShowConditionDeviceType;
  /** Each with at least one Impression or Click. */
  creatives: { creativeId: string; impressions: number; clicks: number }[];
}

/**
 * KEYS: the day's pending set, then per creative its devices hash and its pages hash.
 * ARGV: TTL, page cap, page, device type, the `(other)` page, then per creative: id, impressions, clicks.
 */
const INCREMENT_SCRIPT = `
  local ttl = tonumber(ARGV[1])
  local cap = tonumber(ARGV[2])
  local page = ARGV[3]
  local device = ARGV[4]
  local other = ARGV[5]

  local function expireNew(key)
    if redis.call('TTL', key) == -1 then
      redis.call('EXPIRE', key, ttl)
    end
  end

  for i = 1, (#KEYS - 1) / 2 do
    local devices = KEYS[2 * i]
    local pages = KEYS[2 * i + 1]
    local creativeId = ARGV[3 * i + 3]
    local impressions = tonumber(ARGV[3 * i + 4])
    local clicks = tonumber(ARGV[3 * i + 5])

    local counted = page
    if redis.call('HEXISTS', pages, 'impressions:' .. page) == 0
      and redis.call('HEXISTS', pages, 'clicks:' .. page) == 0 then
      if tonumber(redis.call('HGET', pages, 'pages') or '0') < cap then
        redis.call('HINCRBY', pages, 'pages', 1)
      else
        counted = other
      end
    end

    if impressions > 0 then
      redis.call('HINCRBY', devices, 'impressions:' .. device, impressions)
      redis.call('HINCRBY', pages, 'impressions:' .. counted, impressions)
    end
    if clicks > 0 then
      redis.call('HINCRBY', devices, 'clicks:' .. device, clicks)
      redis.call('HINCRBY', pages, 'clicks:' .. counted, clicks)
    end
    expireNew(devices)
    expireNew(pages)
    redis.call('SADD', KEYS[1], creativeId)
  end
  expireNew(KEYS[1])
  return 1
`;

/**
 * Moves up to ARGV[1] creatives from the day's pending set (KEYS[1]) into its flushing set (KEYS[2]) and
 * returns the whole flushing set. A flush that failed leaves its creatives there, so the next run picks
 * them up first; two runs that overlap flush some creatives twice, which `GREATEST` makes harmless.
 */
const CLAIM_SCRIPT = `
  local claimed = redis.call('SMEMBERS', KEYS[2])
  local wanted = tonumber(ARGV[1]) - #claimed
  if wanted > 0 then
    local popped = redis.call('SPOP', KEYS[1], wanted)
    for _, id in ipairs(popped) do
      redis.call('SADD', KEYS[2], id)
      table.insert(claimed, id)
    end
  end
  if #claimed > 0 and redis.call('TTL', KEYS[2]) == -1 then
    redis.call('EXPIRE', KEYS[2], tonumber(ARGV[2]))
  end
  return claimed
`;

const getRedis = async (): Promise<RedisClientType | null> => await cache.getRedisClient();

/**
 * Adds one events request's counts to its UTC day. Returns `false` when Redis isn't available; throws
 * when Redis refuses the write (for example, out of memory under `noeviction`).
 */
export const incrementCreativeCounters = async (
  counts: TCreativeEventCounts,
  now: Date = new Date()
): Promise<boolean> => {
  if (counts.creatives.length === 0) return true;
  const redis = await getRedis();
  if (!redis) return false;

  const day = toUtcDay(now);
  await redis.eval(INCREMENT_SCRIPT, {
    keys: [
      createCacheKey.creativeStats.pending(day),
      ...counts.creatives.flatMap(({ creativeId }) => [
        createCacheKey.creativeStats.devices(day, creativeId),
        createCacheKey.creativeStats.pages(day, creativeId),
      ]),
    ],
    arguments: [
      String(CREATIVE_COUNTER_TTL_SECONDS),
      String(MAX_COUNTED_PAGES_PER_DAY),
      counts.page,
      counts.deviceType,
      OTHER_PAGE,
      ...counts.creatives.flatMap(({ creativeId, impressions, clicks }) => [
        creativeId,
        String(impressions),
        String(clicks),
      ]),
    ],
  });
  return true;
};

/** The creatives of `day` whose totals the caller should flush next; see `CLAIM_SCRIPT`. */
export const claimCountedCreatives = async (day: string, limit: number): Promise<string[]> => {
  const redis = await getRedis();
  if (!redis) return [];
  return (await redis.eval(CLAIM_SCRIPT, {
    keys: [createCacheKey.creativeStats.pending(day), createCacheKey.creativeStats.flushing(day)],
    arguments: [String(limit), String(CREATIVE_COUNTER_TTL_SECONDS)],
  })) as string[];
};

/** Marks claimed creatives as flushed. Events counted since were added to `pending` again. */
export const releaseCountedCreatives = async (day: string, creativeIds: readonly string[]): Promise<void> => {
  const redis = await getRedis();
  if (!redis || creativeIds.length === 0) return;
  await redis.sRem(createCacheKey.creativeStats.flushing(day), [...creativeIds]);
};

/** Splits `impressions:<x>` / `clicks:<x>` fields into per-`<x>` totals. */
const readTotals = (hash: Record<string, string>): Map<string, { impressions: number; clicks: number }> => {
  const totals = new Map<string, { impressions: number; clicks: number }>();
  for (const [field, value] of Object.entries(hash)) {
    const separator = field.indexOf(":");
    if (separator < 0) continue;
    const kind = field.slice(0, separator);
    if (kind !== "impressions" && kind !== "clicks") continue;
    const name = field.slice(separator + 1);
    const total = totals.get(name) ?? { impressions: 0, clicks: 0 };
    total[kind] = Number(value);
    totals.set(name, total);
  }
  return totals;
};

const isDeviceType = (value: string): value is TShowConditionDeviceType =>
  (SHOW_CONDITION_DEVICE_TYPES as readonly string[]).includes(value);

/** The running totals of `day` for each creative, as rollup rows. */
export const readCreativeCounters = async (
  day: string,
  creativeIds: readonly string[]
): Promise<{ deviceRows: TCreativeDeviceCountRow[]; pageRows: TCreativePageCountRow[] }> => {
  const redis = await getRedis();
  if (!redis) return { deviceRows: [], pageRows: [] };

  const hashes = await Promise.all(
    creativeIds.map(async (creativeId) => {
      const [devices, pages] = await Promise.all([
        redis.hGetAll(createCacheKey.creativeStats.devices(day, creativeId)),
        redis.hGetAll(createCacheKey.creativeStats.pages(day, creativeId)),
      ]);
      return { creativeId, devices, pages };
    })
  );

  const deviceRows: TCreativeDeviceCountRow[] = [];
  const pageRows: TCreativePageCountRow[] = [];
  for (const { creativeId, devices, pages } of hashes) {
    for (const [deviceType, total] of readTotals(devices)) {
      if (isDeviceType(deviceType)) deviceRows.push({ creativeId, date: day, deviceType, ...total });
    }
    for (const [page, total] of readTotals(pages)) {
      pageRows.push({ creativeId, date: day, page, ...total });
    }
  }
  return { deviceRows, pageRows };
};
