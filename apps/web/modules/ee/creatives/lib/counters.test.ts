import type { RedisClientType } from "redis";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createCacheKey } from "@formbricks/cache";
import { cache } from "@/lib/cache";
import {
  claimCountedCreatives,
  incrementCreativeCounters,
  readCreativeCounters,
  releaseCountedCreatives,
} from "./counters";

vi.mock("@/lib/cache", () => ({
  cache: {
    getRedisClient: vi.fn(),
    runRedisOperation: vi.fn(),
  },
}));

const DAY = "2026-11-03";
const CREATIVE_ID = "creative-1";
const counts = {
  page: "example.com/",
  deviceType: "phone" as const,
  creatives: [{ creativeId: CREATIVE_ID, impressions: 2, clicks: 1 }],
};

describe("creative counter Redis commands", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("runs counting and flush commands through the bounded cache operation", async () => {
    const evalCommand = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce([CREATIVE_ID]);
    const removeCommand = vi.fn().mockResolvedValue(1);
    const readCommand = vi
      .fn()
      .mockResolvedValueOnce({ "impressions:phone": "2", "clicks:phone": "1" })
      .mockResolvedValueOnce({ "impressions:example.com/": "2", "clicks:example.com/": "1" })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    const commandClient = {
      eval: evalCommand,
      sCard: vi.fn().mockResolvedValue(0),
      sRem: removeCommand,
      hGetAll: readCommand,
    } as unknown as RedisClientType;

    // The readiness check has no commands. Only the bounded operation receives a usable client.
    vi.mocked(cache.getRedisClient).mockResolvedValue({} as RedisClientType);
    vi.mocked(cache.runRedisOperation).mockImplementation(async (operation) => operation(commandClient));

    await expect(incrementCreativeCounters(counts, new Date(`${DAY}T12:00:00.000Z`))).resolves.toBe(true);
    await expect(claimCountedCreatives(DAY, 10)).resolves.toEqual([CREATIVE_ID]);
    await expect(releaseCountedCreatives(DAY, [CREATIVE_ID])).resolves.toBeUndefined();
    await expect(readCreativeCounters(DAY, [CREATIVE_ID])).resolves.toEqual({
      deviceRows: [{ creativeId: CREATIVE_ID, date: DAY, deviceType: "phone", impressions: 2, clicks: 1 }],
      pageRows: [{ creativeId: CREATIVE_ID, date: DAY, page: "example.com/", impressions: 2, clicks: 1 }],
    });
    expect(removeCommand).toHaveBeenCalledWith(createCacheKey.creativeStats.flushing(DAY), [CREATIVE_ID]);
    expect(removeCommand).toHaveBeenCalledWith(createCacheKey.creativeStats.legacyFlushing(DAY), [
      CREATIVE_ID,
    ]);
  });

  test("does not report a successful count when the bounded Redis command fails", async () => {
    vi.mocked(cache.getRedisClient).mockResolvedValue({} as RedisClientType);
    vi.mocked(cache.runRedisOperation).mockRejectedValueOnce(new Error("Redis operation timed out"));

    await expect(incrementCreativeCounters(counts)).rejects.toThrow("Redis operation timed out");
  });

  test("claims old-format pending counts and combines them with tagged running totals", async () => {
    const commandClient = {
      sCard: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
      eval: vi.fn().mockResolvedValueOnce([CREATIVE_ID]).mockResolvedValueOnce([]),
      hGetAll: vi
        .fn()
        .mockResolvedValueOnce({ "impressions:phone": "3", "clicks:phone": "1" })
        .mockResolvedValueOnce({ "impressions:example.com/": "3", "clicks:example.com/": "1" })
        .mockResolvedValueOnce({ "impressions:phone": "2" })
        .mockResolvedValueOnce({ "impressions:example.com/": "2" }),
    } as unknown as RedisClientType;
    vi.mocked(cache.getRedisClient).mockResolvedValue({} as RedisClientType);
    vi.mocked(cache.runRedisOperation).mockImplementation(async (operation) => operation(commandClient));

    expect(await claimCountedCreatives(DAY, 10)).toEqual([CREATIVE_ID]);
    expect(await readCreativeCounters(DAY, [CREATIVE_ID])).toEqual({
      deviceRows: [{ creativeId: CREATIVE_ID, date: DAY, deviceType: "phone", impressions: 5, clicks: 1 }],
      pageRows: [{ creativeId: CREATIVE_ID, date: DAY, page: "example.com/", impressions: 5, clicks: 1 }],
    });
    expect(commandClient.eval).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({
        keys: [
          createCacheKey.creativeStats.legacyPending(DAY),
          createCacheKey.creativeStats.legacyFlushing(DAY),
        ],
      })
    );
  });

  test("reads a full creative claim without issuing a 200-command burst", async () => {
    const creativeIds = Array.from({ length: 11 }, (_, index) => `creative-${String(index)}`);
    let activeReads = 0;
    let peakReads = 0;
    const readCommand = vi.fn(async (key: string) => {
      activeReads += 1;
      peakReads = Math.max(peakReads, activeReads);
      await Promise.resolve();
      activeReads -= 1;
      return key.endsWith(":devices") ? { "impressions:phone": "1" } : { "impressions:example.com/": "1" };
    });
    const commandClient = { hGetAll: readCommand } as unknown as RedisClientType;
    vi.mocked(cache.getRedisClient).mockResolvedValue({} as RedisClientType);
    vi.mocked(cache.runRedisOperation).mockImplementation(async (operation) => operation(commandClient));

    const result = await readCreativeCounters(DAY, creativeIds);

    expect(result.deviceRows.map((row) => row.creativeId)).toEqual(creativeIds);
    expect(result.pageRows.map((row) => row.creativeId)).toEqual(creativeIds);
    expect(peakReads).toBeLessThanOrEqual(10);
  });
});
