import { describe, expect, test, vi } from "vitest";
import type { PrismaClient } from "../../src/prisma";
import { backfillContactDirectories } from "./migration";

vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

const deadlock = () =>
  Object.assign(new Error("Raw query failed"), {
    code: "P2010",
    meta: { driverAdapterError: { cause: { originalCode: "40P01" } } },
  });

/**
 * A database with one contact left to backfill, whose batches fail with the given errors first. The SQL
 * itself runs against PostgreSQL in migration.integration.test.ts; this covers what that cannot provoke.
 */
const databaseWithBatchErrors = (errors: Error[]) => {
  const batchCalls: unknown[] = [];
  const queryRaw = vi.fn((query: TemplateStringsArray) => {
    const sql = query.join("");
    if (sql.includes(`UPDATE "Contact"`)) {
      batchCalls.push(sql);
      const error = errors.shift();
      if (error) return Promise.reject(error);
      return Promise.resolve([{ lastId: "c1", scanned: 1, written: 1 }]);
    }
    if (sql.includes(`"directoryId" IS NULL`)) return Promise.resolve([{ workspaceId: "w1", contacts: 1 }]);
    return Promise.resolve([{ directoryId: "d1", contacts: 1 }]);
  });
  const prisma = {
    $queryRaw: queryRaw,
    $executeRaw: vi.fn().mockResolvedValue(0),
  } as unknown as PrismaClient;
  return { prisma, batchCalls };
};

describe("contact directory backfill", () => {
  test("retries a batch that deadlocks with a writer of the previous release", async () => {
    const { prisma, batchCalls } = databaseWithBatchErrors([deadlock(), deadlock()]);

    await backfillContactDirectories.run({ prisma, signal: new AbortController().signal });

    // Two failed attempts and one that succeeds in the first pass, one batch in the second.
    expect(batchCalls).toHaveLength(4);
  });

  test("gives up after three deadlocks in a row, and on any other error at once", async () => {
    const persistent = databaseWithBatchErrors([deadlock(), deadlock(), deadlock()]);
    await expect(
      backfillContactDirectories.run({ prisma: persistent.prisma, signal: new AbortController().signal })
    ).rejects.toMatchObject({ code: "P2010" });
    expect(persistent.batchCalls).toHaveLength(3);

    const other = databaseWithBatchErrors([new Error("connection lost")]);
    await expect(
      backfillContactDirectories.run({ prisma: other.prisma, signal: new AbortController().signal })
    ).rejects.toThrow("connection lost");
    expect(other.batchCalls).toHaveLength(1);
  });

  test("stops before the next batch once its signal aborts", async () => {
    const { prisma, batchCalls } = databaseWithBatchErrors([]);
    const controller = new AbortController();
    controller.abort();

    await expect(backfillContactDirectories.run({ prisma, signal: controller.signal })).rejects.toThrow();
    expect(batchCalls).toHaveLength(0);
  });
});
