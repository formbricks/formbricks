import redis from "@/lib/redis";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  AUDIT_LOG_HASH_KEY,
  getPreviousAuditLogHash,
  runAuditLogHashTransaction,
  setPreviousAuditLogHash,
} from "./cache";

// Mock redis module
vi.mock("@/lib/redis", () => {
  let store: Record<string, string | null> = {};
  return {
    default: {
      del: vi.fn(async (key: string) => {
        store[key] = null;
        return 1;
      }),
      quit: vi.fn(async () => {
        return "OK";
      }),
      get: vi.fn(async (key: string) => {
        return store[key] ?? null;
      }),
      set: vi.fn(async (key: string, value: string) => {
        store[key] = value;
        return "OK";
      }),
      watch: vi.fn(async (_key: string) => {
        return "OK";
      }),
      multi: vi.fn(() => {
        return {
          set: vi.fn(function (key: string, value: string) {
            store[key] = value;
            return this;
          }),
          exec: vi.fn(async () => {
            return [[null, "OK"]];
          }),
        } as unknown as import("ioredis").ChainableCommander;
      }),
    },
  };
});

describe("audit log cache utils", () => {
  beforeEach(async () => {
    await redis.del(AUDIT_LOG_HASH_KEY);
  });

  afterAll(async () => {
    await redis.quit();
  });

  test("should get and set the previous audit log hash", async () => {
    expect(await getPreviousAuditLogHash()).toBeNull();
    await setPreviousAuditLogHash("testhash");
    expect(await getPreviousAuditLogHash()).toBe("testhash");
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

  test("should retry and eventually throw if the hash keeps changing", async () => {
    // Simulate another process changing the hash every time
    let callCount = 0;
    const originalMulti = redis.multi;
    (redis.multi as any).mockImplementation(() => {
      return {
        set: vi.fn(function (key: string, value: string) {
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
      expect.fail("Error was not thrown by runAuditLogHashTransaction");
    } catch (e) {
      errorCaught = true;
      expect((e as Error).message).toContain("Failed to update audit log hash after multiple retries");
    }
    expect(errorCaught).toBe(true);
    expect(callCount).toBe(5);
    // Restore
    (redis.multi as any).mockImplementation(originalMulti);
  });
});
