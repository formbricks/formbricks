import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { cache } from "@/lib/cache";
import {
  CREATIVE_COUNTER_TTL_SECONDS,
  MAX_COUNTED_PAGES_PER_DAY,
  type TCreativeEventCounts,
  claimCountedCreatives,
  incrementCreativeCounters,
} from "./counters";
import { flushCreativeCounters } from "./stats-flush";
import { findCreativeDayDeviceCounts, findCreativePageCounts } from "./stats-repository";

/**
 * The counting pipeline against a real Redis and PostgreSQL (ENG-4000): the Lua
 * counters, the flush with `GREATEST(stored, counted)`, the page cap and the rollup reads. Neither the
 * Lua script nor the upsert can be faked without testing the fake instead.
 */

vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

/** Every `getRedisClient` call gets the real client, unless `isDown` says Redis is unavailable for it. */
const redisOutage = vi.hoisted(() => ({ isDown: async (): Promise<boolean> => false }));
vi.mock("@/lib/cache", async (importOriginal) => {
  const { cache } = await importOriginal<typeof import("@/lib/cache")>();
  return {
    cache: new Proxy(cache, {
      get: (target, prop: keyof typeof cache) =>
        prop === "getRedisClient"
          ? async () => ((await redisOutage.isDown()) ? null : await target.getRedisClient())
          : target[prop],
    }),
  };
});

const TODAY = "2026-10-16";
const AT_NOON = new Date(`${TODAY}T12:00:00.000Z`);

const redisClient = async () => {
  const redis = await cache.getRedisClient();
  if (!redis) throw new Error("The integration harness needs Redis");
  return redis;
};

/** Only this pipeline's keys: other integration files share the Redis database. */
const clearCounters = async () => {
  const redis = await redisClient();
  for await (const keys of redis.scanIterator({ MATCH: "fb:creative-stats:*", COUNT: 1000 })) {
    if (keys.length > 0) await redis.del(keys);
  }
};

const seedCreatives = async (count: number) => {
  const organization = await prisma.organization.create({ data: { name: "Counting Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Counting Workspace", organizationId: organization.id },
  });
  const creatives = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      prisma.creative.create({
        data: {
          name: `Creative ${String(index)}`,
          type: "feedbackButton",
          status: "inProgress",
          workspaceId: workspace.id,
          content: {},
          styling: {},
          linkUrl: "https://example.com",
        },
      })
    )
  );
  return { workspaceId: workspace.id, ids: creatives.map(({ id }) => id) };
};

const counts = (
  page: string,
  deviceType: TCreativeEventCounts["deviceType"],
  creatives: TCreativeEventCounts["creatives"]
): TCreativeEventCounts => ({ page, deviceType, creatives });

const stored = async (creativeId: string, workspaceId: string, day = TODAY) => ({
  devices: await findCreativeDayDeviceCounts(creativeId, workspaceId, day, day),
  pages: await findCreativePageCounts(creativeId, workspaceId, day, day, 2_000),
});

const byPage = (pages: { page: string }[]) => [...pages].sort((a, b) => (a.page < b.page ? -1 : 1));

beforeEach(async () => {
  redisOutage.isDown = async () => false;
  await resetDb();
  await clearCounters();
});

afterAll(async () => {
  await clearCounters();
});

describe("counting and flushing", () => {
  test("Impressions and Clicks reach the daily tables, by device type and by page", async () => {
    const { workspaceId, ids } = await seedCreatives(1);
    const [creativeId] = ids;
    await incrementCreativeCounters(
      counts("example.com/pricing", "phone", [{ creativeId, impressions: 1, clicks: 1 }]),
      AT_NOON
    );
    await incrementCreativeCounters(
      counts("example.com/", "desktop", [{ creativeId, impressions: 1, clicks: 0 }]),
      AT_NOON
    );
    await incrementCreativeCounters(
      counts("example.com/pricing", "phone", [{ creativeId, impressions: 1, clicks: 0 }]),
      AT_NOON
    );

    await flushCreativeCounters(AT_NOON);

    const { devices, pages } = await stored(creativeId, workspaceId);
    expect(devices).toEqual(
      expect.arrayContaining([
        { date: TODAY, deviceType: "phone", impressions: 2, clicks: 1 },
        { date: TODAY, deviceType: "desktop", impressions: 1, clicks: 0 },
      ])
    );
    expect(devices).toHaveLength(2);
    expect(byPage(pages)).toEqual([
      { page: "example.com/", impressions: 1, clicks: 0 },
      { page: "example.com/pricing", impressions: 2, clicks: 1 },
    ]);
  });

  test("a repeated flush changes nothing, events counted after a flush land with the next one, and no flush lowers a stored count", async () => {
    const { workspaceId, ids } = await seedCreatives(1);
    const [creativeId] = ids;
    const view = counts("example.com/", "tablet", [{ creativeId, impressions: 1, clicks: 0 }]);
    await incrementCreativeCounters(view, AT_NOON);
    await flushCreativeCounters(AT_NOON);
    const first = await stored(creativeId, workspaceId);

    await flushCreativeCounters(AT_NOON);
    expect(await stored(creativeId, workspaceId)).toEqual(first);

    await incrementCreativeCounters(view, AT_NOON);
    await flushCreativeCounters(AT_NOON);
    expect((await stored(creativeId, workspaceId)).devices).toEqual([
      { date: TODAY, deviceType: "tablet", impressions: 2, clicks: 0 },
    ]);

    // Redis lost its counters (a restart without persistence): what it counts next starts from zero.
    await clearCounters();
    await incrementCreativeCounters(view, AT_NOON);
    await flushCreativeCounters(AT_NOON);
    expect((await stored(creativeId, workspaceId)).devices).toEqual([
      { date: TODAY, deviceType: "tablet", impressions: 2, clicks: 0 },
    ]);
  });

  test("a creative counted again after a failed flush is written once by the retry", async () => {
    const { workspaceId, ids } = await seedCreatives(1);
    const [creativeId] = ids;
    const view = counts("example.com/", "phone", [{ creativeId, impressions: 1, clicks: 0 }]);
    await incrementCreativeCounters(view, AT_NOON);
    // A flush claimed it and failed before releasing it, so it stays claimed…
    await claimCountedCreatives(TODAY, 100);
    // …and the next event puts it back in `pending` too.
    await incrementCreativeCounters(view, AT_NOON);

    await flushCreativeCounters(AT_NOON);

    expect((await stored(creativeId, workspaceId)).devices).toEqual([
      { date: TODAY, deviceType: "phone", impressions: 2, clicks: 0 },
    ]);
  });

  test("a flush that loses Redis after claiming fails and keeps its claim, so the next flush writes the count", async () => {
    const { workspaceId, ids } = await seedCreatives(1);
    const [creativeId] = ids;
    await incrementCreativeCounters(
      counts("example.com/", "phone", [{ creativeId, impressions: 1, clicks: 0 }]),
      AT_NOON
    );
    // Redis is unavailable for one call, the first after the claim (the read), and back for the rest.
    const redis = await redisClient();
    let wasDown = false;
    redisOutage.isDown = async () => {
      if (wasDown || (await redis.sCard(createCacheKey.creativeStats.flushing(TODAY))) === 0) return false;
      wasDown = true;
      return true;
    };

    await expect(flushCreativeCounters(AT_NOON)).rejects.toThrow();
    await flushCreativeCounters(AT_NOON);

    expect((await stored(creativeId, workspaceId)).devices).toEqual([
      { date: TODAY, deviceType: "phone", impressions: 1, clicks: 0 },
    ]);
  });

  test("events counted late on a UTC day land with the first flush after midnight", async () => {
    const { workspaceId, ids } = await seedCreatives(1);
    const [creativeId] = ids;
    await incrementCreativeCounters(
      counts("example.com/", "phone", [{ creativeId, impressions: 1, clicks: 1 }]),
      new Date(`${TODAY}T23:59:59.000Z`)
    );

    await flushCreativeCounters(new Date("2026-10-17T00:00:30.000Z"));

    expect((await stored(creativeId, workspaceId)).devices).toEqual([
      { date: TODAY, deviceType: "phone", impressions: 1, clicks: 1 },
    ]);
  });

  test(`a creative counts at most ${String(MAX_COUNTED_PAGES_PER_DAY)} pages a day, the rest under (other)`, async () => {
    const { workspaceId, ids } = await seedCreatives(1);
    const [creativeId] = ids;
    const view = (page: string) =>
      incrementCreativeCounters(
        counts(page, "desktop", [{ creativeId, impressions: 1, clicks: 0 }]),
        AT_NOON
      );
    for (let index = 0; index < MAX_COUNTED_PAGES_PER_DAY + 2; index += 1) {
      await view(`example.com/page-${String(index)}`);
    }
    // A page counted before the cap keeps counting under its own name.
    await view("example.com/page-0");

    await flushCreativeCounters(AT_NOON);

    const { devices, pages } = await stored(creativeId, workspaceId);
    expect(devices).toEqual([
      { date: TODAY, deviceType: "desktop", impressions: MAX_COUNTED_PAGES_PER_DAY + 3, clicks: 0 },
    ]);
    expect(pages).toHaveLength(MAX_COUNTED_PAGES_PER_DAY + 1);
    expect(pages).toEqual(
      expect.arrayContaining([
        { page: "example.com/page-0", impressions: 2, clicks: 0 },
        { page: "(other)", impressions: 2, clicks: 0 },
      ])
    );
    expect(pages.map(({ page }) => page)).not.toContain(
      `example.com/page-${String(MAX_COUNTED_PAGES_PER_DAY)}`
    );
  });

  test("a creative deleted since it was counted is skipped, and the rest of its batch still lands", async () => {
    const { workspaceId, ids } = await seedCreatives(2);
    const [kept, deleted] = ids;
    await incrementCreativeCounters(
      counts("example.com/", "phone", [
        { creativeId: kept, impressions: 1, clicks: 0 },
        { creativeId: deleted, impressions: 1, clicks: 0 },
      ]),
      AT_NOON
    );
    await prisma.creative.delete({ where: { id: deleted } });

    await flushCreativeCounters(AT_NOON);

    expect((await stored(kept, workspaceId)).devices).toHaveLength(1);
    expect(await prisma.creativeDailyStat.count({ where: { creativeId: deleted } })).toBe(0);
  });

  test("deleting a creative deletes its counts", async () => {
    const { ids } = await seedCreatives(1);
    const [creativeId] = ids;
    await incrementCreativeCounters(
      counts("example.com/", "phone", [{ creativeId, impressions: 1, clicks: 0 }]),
      AT_NOON
    );
    await flushCreativeCounters(AT_NOON);

    await prisma.creative.delete({ where: { id: creativeId } });

    expect(await prisma.creativeDailyStat.count({ where: { creativeId } })).toBe(0);
    expect(await prisma.creativeDailyPageStat.count({ where: { creativeId } })).toBe(0);
  });

  test("the counters expire about two days after their day's first event", async () => {
    const { ids } = await seedCreatives(1);
    const [creativeId] = ids;
    await incrementCreativeCounters(
      counts("example.com/", "phone", [{ creativeId, impressions: 1, clicks: 0 }]),
      AT_NOON
    );

    const redis = await redisClient();
    const keys: string[] = [];
    for await (const batch of redis.scanIterator({ MATCH: "fb:creative-stats:*", COUNT: 1000 })) {
      keys.push(...batch);
    }
    expect(keys.length).toBeGreaterThanOrEqual(3);
    for (const key of keys) {
      const ttl = await redis.ttl(key);
      expect(ttl).toBeGreaterThan(CREATIVE_COUNTER_TTL_SECONDS - 60);
      expect(ttl).toBeLessThanOrEqual(CREATIVE_COUNTER_TTL_SECONDS);
    }
  });
});

describe("findCreativePageCounts", () => {
  test("lists the pages with the most Impressions and sums the rest, with the counted (other), into (other)", async () => {
    const { workspaceId, ids } = await seedCreatives(1);
    const [creativeId] = ids;
    const day = (date: string) => new Date(date);
    await prisma.creativeDailyPageStat.createMany({
      data: [
        { creativeId, date: day("2026-10-15"), page: "example.com/a", impressions: 5, clicks: 1 },
        { creativeId, date: day("2026-10-16"), page: "example.com/a", impressions: 5, clicks: 0 },
        { creativeId, date: day("2026-10-16"), page: "example.com/b", impressions: 7, clicks: 0 },
        { creativeId, date: day("2026-10-16"), page: "example.com/c", impressions: 3, clicks: 2 },
        { creativeId, date: day("2026-10-16"), page: "(other)", impressions: 4, clicks: 1 },
        { creativeId, date: day("2026-10-17"), page: "example.com/d", impressions: 50, clicks: 0 },
      ],
    });

    const pages = await findCreativePageCounts(creativeId, workspaceId, "2026-10-15", "2026-10-16", 2);

    expect(byPage(pages)).toEqual([
      { page: "(other)", impressions: 7, clicks: 3 },
      { page: "example.com/a", impressions: 10, clicks: 1 },
      { page: "example.com/b", impressions: 7, clicks: 0 },
    ]);
  });

  test("reads only the creative's own workspace", async () => {
    const { ids } = await seedCreatives(1);
    const [creativeId] = ids;
    await prisma.creativeDailyStat.create({
      data: { creativeId, date: new Date(TODAY), deviceType: "phone", impressions: 1, clicks: 0 },
    });

    expect(await findCreativeDayDeviceCounts(creativeId, "clotherworkspace0000000000", TODAY, TODAY)).toEqual(
      []
    );
  });
});
