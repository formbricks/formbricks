import redis from "@/lib/redis";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  AUDIT_LOG_HASH_KEY,
  getPreviousAuditLogHash,
  runAuditLogHashTransaction,
  setPreviousAuditLogHash,
} from "./cache";

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
    const originalWatch = redis.watch.bind(redis);
    vi.spyOn(redis, "watch").mockImplementation(async (key) => {
      await originalWatch(key);
      return "OK";
    });
    vi.spyOn(redis, "multi").mockImplementation(
      () =>
        ({
          set: () => {},
          exec: async () => {
            callCount++;
            return null;
          },
        }) as unknown as import("ioredis").ChainableCommander
    );
    let errorCaught = false;
    try {
      await runAuditLogHashTransaction(async () => {
        return {
          auditEvent: async () => {},
          integrityHash: "conflict-hash",
        };
      });
      // If we get here, the error was not thrown
      expect.fail("Error was not thrown by runAuditLogHashTransaction");
    } catch (e) {
      errorCaught = true;
      expect((e as Error).message).toContain("Failed to update audit log hash after multiple retries");
    }
    expect(errorCaught).toBe(true);
    expect(callCount).toBe(5);
    // Restore
    (redis.watch as any).mockRestore();
    (redis.multi as any).mockRestore();
  });
});
