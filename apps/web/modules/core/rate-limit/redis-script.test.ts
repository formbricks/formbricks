import type { RedisClientType } from "redis";
import { describe, expect, test, vi } from "vitest";
import { runRateLimitScript } from "./redis-script";

const script = { SHA1: "a".repeat(40), SCRIPT: "return 1" };
const keys = ["limit:key"];
const args = ["5"];

describe("runRateLimitScript", () => {
  test("uses the hash for a loaded script", async () => {
    const redis = { evalSha: vi.fn().mockResolvedValue([1, 1]), eval: vi.fn() };

    await expect(
      runRateLimitScript(redis as unknown as RedisClientType, script, keys, args)
    ).resolves.toEqual([1, 1]);
    expect(redis.evalSha).toHaveBeenCalledWith(script.SHA1, { keys, arguments: args });
    expect(redis.eval).not.toHaveBeenCalled();
  });

  test("loads the script on NOSCRIPT without retrying other Redis errors", async () => {
    const redis = {
      evalSha: vi.fn().mockRejectedValueOnce(new Error("NOSCRIPT No matching script")),
      eval: vi.fn().mockResolvedValue([1, 1]),
    };

    await expect(
      runRateLimitScript(redis as unknown as RedisClientType, script, keys, args)
    ).resolves.toEqual([1, 1]);
    expect(redis.eval).toHaveBeenCalledWith(script.SCRIPT, { keys, arguments: args });

    const failure = new Error("connection lost");
    redis.evalSha.mockRejectedValueOnce(failure);
    await expect(runRateLimitScript(redis as unknown as RedisClientType, script, keys, args)).rejects.toBe(
      failure
    );
    expect(redis.eval).toHaveBeenCalledOnce();
  });
});
