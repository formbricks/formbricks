import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { getPreviousAuditLogHash, runAuditLogHashTransaction, setPreviousAuditLogHash } from "./cache";

// Mock redis module
let mockStore: Record<string, string | null> = {};
let mockRedisAvailable = true;

const mockRedisClient = {
  isReady: true,
  del: vi.fn(async (key: string) => {
    delete mockStore[key];
    return 1;
  }),
  quit: vi.fn(async () => {
    return "OK";
  }),
  get: vi.fn(async (key: string) => {
    return mockStore[key] ?? null;
  }),
  set: vi.fn(async (key: string, value: string) => {
    mockStore[key] = value;
    return "OK";
  }),
  watch: vi.fn(async (_key: string) => {
    return "OK";
  }),
  unwatch: vi.fn(async () => {
    return "OK";
  }),
  multi: vi.fn(() => {
    return {
      set: vi.fn(function (key: string, value: string) {
        mockStore[key] = value;
        return this;
      }),
      exec: vi.fn(async () => {
        return [[null, "OK"]];
      }),
    } as unknown as import("ioredis").ChainableCommander;
  }),
};

vi.mock("@/modules/cache/redis", () => {
  return {
    getRedisClient: vi.fn(() => {
      if (!mockRedisAvailable) {
        return null;
      }
      return mockRedisClient;
    }),
  };
});

describe("audit log cache utils", () => {
  beforeEach(async () => {
    // Reset the store for each test
    mockStore = {};
    mockRedisAvailable = true;
    vi.clearAllMocks();
  });

  afterAll(async () => {
    if (mockRedisClient) {
      await mockRedisClient.quit();
    }
  });

  test("should get and set the previous audit log hash", async () => {
    expect(await getPreviousAuditLogHash()).toBeNull();
    await setPreviousAuditLogHash("testhash");
    expect(await getPreviousAuditLogHash()).toBe("testhash");
  });

  test("should return null when redis is not available", async () => {
    mockRedisAvailable = false;
    expect(await getPreviousAuditLogHash()).toBeNull();
  });

  test("should handle redis not available during set operation", async () => {
    mockRedisAvailable = false;
    // Should not throw an error, just return silently
    await setPreviousAuditLogHash("testhash");
    expect(mockRedisClient.set).not.toHaveBeenCalled();
  });

  test("should run a successful audit log hash transaction", async () => {
    let logCalled = false;
    await runAuditLogHashTransaction(async (previousHash) => {
      expect(previousHash).toBeNull();
      return {
        auditEvent: async () => {
          logCalled = true;
        },
        integrityHash: "hash1",
      };
    });
    expect(await getPreviousAuditLogHash()).toBe("hash1");
    expect(logCalled).toBe(true);
  });

  test("should throw error when redis is not available during transaction", async () => {
    mockRedisAvailable = false;

    let errorCaught = false;
    try {
      await runAuditLogHashTransaction(async () => {
        return {
          auditEvent: async () => {},
          integrityHash: "hash1",
        };
      });
    } catch (e) {
      errorCaught = true;
      expect((e as Error).message).toBe("Redis is not initialized");
    }
    expect(errorCaught).toBe(true);
  });

  test("should retry and eventually throw if the hash keeps changing", async () => {
    // Simulate transaction failure by making exec return null
    let callCount = 0;
    mockRedisClient.multi.mockImplementation(() => {
      return {
        set: vi.fn(function () {
          return this;
        }),
        exec: vi.fn(async () => {
          callCount++;
          return null; // Simulate transaction failure
        }),
      } as unknown as import("ioredis").ChainableCommander;
    });

    let errorCaught = false;
    try {
      await runAuditLogHashTransaction(async () => {
        return {
          auditEvent: async () => {},
          integrityHash: "conflict-hash",
        };
      });
      throw new Error("Error was not thrown by runAuditLogHashTransaction");
    } catch (e) {
      errorCaught = true;
      expect((e as Error).message).toContain("Failed to update audit log hash after multiple retries");
    }
    expect(errorCaught).toBe(true);
    expect(callCount).toBe(5);
  });
});
