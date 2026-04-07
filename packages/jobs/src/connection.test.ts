import IORedis from "ioredis";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  closeRedisConnection,
  createProducerConnection,
  createWorkerConnection,
  getRedisUrlFromEnv,
} from "./connection";

const { mockDisconnect, mockOn, mockQuit } = vi.hoisted(() => ({
  mockOn: vi.fn(),
  mockQuit: vi.fn(),
  mockDisconnect: vi.fn(),
}));

vi.mock("ioredis", () => ({
  default: vi.fn(function MockRedis() {
    return {
      on: mockOn,
      quit: mockQuit,
      disconnect: mockDisconnect,
      status: "ready",
    };
  }),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("@formbricks/jobs connection helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REDIS_URL;
  });

  test("creates producer connections with fail-fast options", () => {
    createProducerConnection({ redisUrl: "redis://localhost:6379" });

    expect(IORedis).toHaveBeenCalledWith(
      "redis://localhost:6379",
      expect.objectContaining({
        connectionName: "formbricks-jobs-producer",
        connectTimeout: 3000,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      })
    );
    expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
  });

  test("creates worker connections with blocking-safe options", () => {
    createWorkerConnection({ redisUrl: "redis://localhost:6379" });

    expect(IORedis).toHaveBeenCalledWith(
      "redis://localhost:6379",
      expect.objectContaining({
        connectionName: "formbricks-jobs-worker",
        connectTimeout: 3000,
        maxRetriesPerRequest: null,
      })
    );
    expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
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
      quit: mockQuit.mockResolvedValue(undefined),
      disconnect: mockDisconnect,
      status: "ready",
    } as unknown as IORedis);

    expect(mockQuit).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  test("disconnects a non-ready Redis connection", async () => {
    await closeRedisConnection({
      quit: mockQuit,
      disconnect: mockDisconnect,
      status: "connecting",
    } as unknown as IORedis);

    expect(mockQuit).not.toHaveBeenCalled();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
