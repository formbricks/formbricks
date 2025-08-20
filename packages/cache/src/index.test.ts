import { describe, expect, test } from "vitest";
import { createCacheService, createRedisClientFromEnv } from "./index";

describe("@formbricks/cache index exports", () => {
  test("should export all required functions and constants", () => {
    expect(typeof createRedisClientFromEnv).toBe("function");
    expect(typeof createCacheService).toBe("function");
  });
});
