import type { RedisClientType } from "redis";
import { beforeEach, describe, expect, test, vi } from "vitest";
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
      .mockResolvedValueOnce({ "impressions:example.com/": "2", "clicks:example.com/": "1" });
    const commandClient = {
      eval: evalCommand,
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
    expect(cache.runRedisOperation).toHaveBeenCalledTimes(4);
  });

  test("does not report a successful count when the bounded Redis command fails", async () => {
    vi.mocked(cache.getRedisClient).mockResolvedValue({} as RedisClientType);
    vi.mocked(cache.runRedisOperation).mockRejectedValueOnce(new Error("Redis operation timed out"));

    await expect(incrementCreativeCounters(counts)).rejects.toThrow("Redis operation timed out");
  });
});
