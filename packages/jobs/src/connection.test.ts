import type IORedis from "ioredis";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createMockLogger, createMockRedisConnection } from "../test/boundary-mocks";
import {
  closeRedisConnection,
  createProducerConnection,
  createWorkerConnection,
  getRedisUrlFromEnv,
} from "./connection";

const mockRedisConnection = createMockRedisConnection();
const mockLogger = createMockLogger();
const MockIORedis = vi.fn(function MockRedis(_redisUrl?: string, _options?: unknown) {
  return mockRedisConnection;
});

vi.mock("ioredis", () => ({
  default: function MockRedis(redisUrl?: string, options?: unknown) {
    return MockIORedis(redisUrl, options);
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: (context: unknown, message?: string): void => {
      mockLogger.error(context, message);
    },
    info: (context: unknown, message?: string): void => {
      mockLogger.info(context, message);
    },
    warn: (context: unknown, message?: string): void => {
      mockLogger.warn(context, message);
    },
    debug: (context: unknown, message?: string): void => {
      mockLogger.debug(context, message);
    },
  },
}));

describe("@formbricks/jobs connection helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REDIS_URL;
    mockRedisConnection.status = "ready";
  });

  test("creates producer connections with fail-fast options", () => {
    createProducerConnection({ redisUrl: "redis://localhost:6379" });

    expect(MockIORedis).toHaveBeenCalledWith(
      "redis://localhost:6379",
      expect.objectContaining({
        connectionName: "formbricks-jobs-producer",
        connectTimeout: 3000,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      })
    );
    expect(mockRedisConnection.on).toHaveBeenCalledWith("error", expect.any(Function));
  });

  test("creates worker connections with blocking-safe options", () => {
    createWorkerConnection({ redisUrl: "redis://localhost:6379" });

    expect(MockIORedis).toHaveBeenCalledWith(
      "redis://localhost:6379",
      expect.objectContaining({
        connectionName: "formbricks-jobs-worker",
        connectTimeout: 3000,
        maxRetriesPerRequest: null,
      })
    );
    expect(mockRedisConnection.on).toHaveBeenCalledWith("error", expect.any(Function));
  });

  test("reads REDIS_URL from the environment", () => {
    process.env.REDIS_URL = "redis://localhost:6379";

    expect(getRedisUrlFromEnv()).toBe("redis://localhost:6379");
  });

  test("throws when REDIS_URL is missing", () => {
    expect(() => getRedisUrlFromEnv()).toThrow("REDIS_URL is required for BullMQ");
  });

  test("throws when REDIS_URL is malformed", () => {
    process.env.REDIS_URL = "not-a-url";

    expect(() => getRedisUrlFromEnv()).toThrow("REDIS_URL must be a valid URL for BullMQ");
  });

  test("quits an active Redis connection", async () => {
    await closeRedisConnection({
      quit: mockRedisConnection.quit.mockResolvedValue(undefined),
      disconnect: mockRedisConnection.disconnect,
      status: "ready",
    } as unknown as IORedis);

    expect(mockRedisConnection.quit).toHaveBeenCalledTimes(1);
    expect(mockRedisConnection.disconnect).not.toHaveBeenCalled();
  });

  test("disconnects a non-ready Redis connection", async () => {
    await closeRedisConnection({
      quit: mockRedisConnection.quit,
      disconnect: mockRedisConnection.disconnect,
      status: "connecting",
    } as unknown as IORedis);

    expect(mockRedisConnection.quit).not.toHaveBeenCalled();
    expect(mockRedisConnection.disconnect).toHaveBeenCalledTimes(1);
  });
});
