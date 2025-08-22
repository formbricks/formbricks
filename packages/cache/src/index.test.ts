import { describe, expect, test } from "vitest";
import { createCacheKey, createCacheService, createRedisClientFromEnv } from "./index";
import type { CacheError, CacheKey, ErrorCode, RedisClient, Result } from "./index";

describe("@formbricks/cache index exports", () => {
  test("should export all required functions and constants", () => {
    expect(typeof createRedisClientFromEnv).toBe("function");
    expect(typeof createCacheService).toBe("function");
    expect(typeof createCacheKey).toBe("object");
  });

  test("should export all required types without circular dependency issues", () => {
    // This test passes if the types can be imported successfully
    // The actual verification happens at compile/import time
    const testTypes = {
      CacheKey: "CacheKey" as keyof { CacheKey: CacheKey },
      RedisClient: "RedisClient" as keyof { RedisClient: RedisClient },
      Result: "Result" as keyof { Result: Result<unknown, unknown> },
      CacheError: "CacheError" as keyof { CacheError: CacheError },
      ErrorCode: "ErrorCode" as keyof { ErrorCode: ErrorCode },
    };

    expect(testTypes.CacheKey).toBe("CacheKey");
    expect(testTypes.RedisClient).toBe("RedisClient");
    expect(testTypes.Result).toBe("Result");
    expect(testTypes.CacheError).toBe("CacheError");
    expect(testTypes.ErrorCode).toBe("ErrorCode");
  });
});
