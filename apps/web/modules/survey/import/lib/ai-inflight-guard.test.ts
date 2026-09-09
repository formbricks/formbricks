import { beforeEach, describe, expect, test, vi } from "vitest";
import { cache } from "@/lib/cache";
import { ImportInProgressError, acquireAiImportSlot, aiInflightKey } from "./ai-inflight-guard";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("@/lib/cache", () => ({ cache: { getRedisClient: vi.fn() } }));

const redis = { incr: vi.fn(), expire: vi.fn(), decr: vi.fn(), del: vi.fn() };

describe("acquireAiImportSlot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cache.getRedisClient).mockResolvedValue(redis as never);
    redis.expire.mockResolvedValue(1);
    redis.del.mockResolvedValue(1);
  });

  test("the first two conversions get a slot, the third is refused with a retry hint", async () => {
    redis.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    redis.decr.mockResolvedValue(2);

    await acquireAiImportSlot("user1");
    await acquireAiImportSlot("user1");
    await expect(acquireAiImportSlot("user1")).rejects.toMatchObject({
      name: "ImportInProgressError",
      retryAfter: 30,
    });

    expect(redis.incr).toHaveBeenCalledWith(aiInflightKey("user1"));
    expect(redis.expire).toHaveBeenCalledWith(aiInflightKey("user1"), 120);
    // The refused request gives its increment back so it does not poison the count.
    expect(redis.decr).toHaveBeenCalledTimes(1);
  });

  test("release decrements once, deletes the key at zero and is safe to call twice", async () => {
    redis.incr.mockResolvedValue(1);
    redis.decr.mockResolvedValue(0);

    const release = await acquireAiImportSlot("user1");
    await release();
    await release();

    expect(redis.decr).toHaveBeenCalledTimes(1);
    expect(redis.del).toHaveBeenCalledWith(aiInflightKey("user1"));
  });

  test("without Redis or on Redis failure the guard steps aside", async () => {
    vi.mocked(cache.getRedisClient).mockResolvedValueOnce(null as never);
    await expect(acquireAiImportSlot("user1")).resolves.toBeTypeOf("function");

    redis.incr.mockRejectedValueOnce(new Error("down"));
    const release = await acquireAiImportSlot("user1");
    await release();
    expect(redis.decr).not.toHaveBeenCalled();
  });

  test("ImportInProgressError carries the wait", () => {
    expect(new ImportInProgressError().retryAfter).toBe(30);
  });
});
