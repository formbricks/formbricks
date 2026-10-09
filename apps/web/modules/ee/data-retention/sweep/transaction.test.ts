import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import {
  RETENTION_SWEEP_STATEMENT_TIMEOUT_MS,
  RETENTION_SWEEP_TRANSACTION_MAX_WAIT_MS,
  RETENTION_SWEEP_TRANSACTION_TIMEOUT_MS,
} from "./constants";
import {
  RetentionPolicyChangedError,
  type TRetentionPolicySnapshot,
  lockUnchangedRetentionPolicy,
  readDatabaseClock,
  runSweepTransaction,
} from "./transaction";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { $transaction: vi.fn() } }));

/**
 * The lock and the statement timeout against a real database are proven by the sweep's integration
 * suites (`sweep.integration.test.ts`, `*-sweeper.integration.test.ts`: "policy changed mid-run"). These
 * pin the comparison the run's snapshot is held to, and the bounds every sweep transaction gets.
 */
const statement = (call: unknown[]) => {
  const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql.replace(/\s+/g, " "), values: sql.values };
};

const ENABLED_AT = new Date("2030-01-01T00:00:00.000Z");
const SNAPSHOT: TRetentionPolicySnapshot = {
  id: "clpol",
  organizationId: "clorg",
  entity: "surveys",
  enabledAt: ENABLED_AT,
  warnDays: 7,
  periodDays: 90,
  conditions: ["noResponse", "createdBefore"],
};
const ROW = {
  enabled: true,
  enabledAt: new Date(ENABLED_AT),
  warnDays: 7,
  periodDays: 90,
  conditions: ["createdBefore", "noResponse"],
};

describe("runSweepTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("bounds the transaction, sets the statement timeout first, and returns the work's result", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) };
    vi.mocked(prisma.$transaction).mockImplementation(((run: (client: typeof tx) => unknown) =>
      run(tx)) as never);
    const work = vi.fn().mockResolvedValue("done");

    await expect(runSweepTransaction(work)).resolves.toBe("done");

    expect(vi.mocked(prisma.$transaction).mock.calls[0][1]).toEqual({
      timeout: RETENTION_SWEEP_TRANSACTION_TIMEOUT_MS,
      maxWait: RETENTION_SWEEP_TRANSACTION_MAX_WAIT_MS,
    });
    const { text, values } = statement(tx.$queryRaw.mock.calls[0]);
    expect(text).toBe("SELECT set_config('statement_timeout', ?, true)");
    expect(values).toEqual([String(RETENTION_SWEEP_STATEMENT_TIMEOUT_MS)]);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(work.mock.invocationCallOrder[0]);
    expect(work).toHaveBeenCalledWith(tx);
  });
});

describe("lockUnchangedRetentionPolicy", () => {
  const lockWith = (row: unknown) => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue(row ? [row] : []) };
    return { tx, run: () => lockUnchangedRetentionPolicy(tx as never, SNAPSHOT) };
  };

  test("holds the policy row FOR SHARE and passes while it matches the snapshot, in any condition order", async () => {
    const { tx, run } = lockWith(ROW);

    await expect(run()).resolves.toBeUndefined();

    const { text, values } = statement(tx.$queryRaw.mock.calls[0]);
    expect(text).toContain('FROM "RetentionPolicy" WHERE "id" = ? FOR SHARE');
    expect(values).toEqual(["clpol"]);
  });

  test.each([
    ["the policy row is gone", null],
    ["the policy was paused", { ...ROW, enabled: false }],
    ["the policy lost its enabledAt", { ...ROW, enabledAt: null }],
    ["the warning restarted", { ...ROW, enabledAt: new Date("2030-01-02T00:00:00.000Z") }],
    ["the warning was changed", { ...ROW, warnDays: 14 }],
    ["the period was changed", { ...ROW, periodDays: 30 }],
    ["a condition was removed", { ...ROW, conditions: ["noResponse"] }],
    ["a condition was swapped", { ...ROW, conditions: ["noResponse", "noChange"] }],
    ["every condition was cleared", { ...ROW, conditions: [] }],
    ["a condition was repeated in place of another", { ...ROW, conditions: ["noResponse", "noResponse"] }],
  ])("stops the run when %s", async (_case, row) => {
    const { run } = lockWith(row);

    const error = await run().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RetentionPolicyChangedError);
    expect(error).toMatchObject({ entity: "surveys", name: "RetentionPolicyChangedError" });
  });
});

describe("readDatabaseClock", () => {
  test("reads clock_timestamp(), not the transaction's start", async () => {
    const now = new Date("2030-01-03T04:05:06.789Z");
    const client = { $queryRaw: vi.fn().mockResolvedValue([{ now }]) };

    await expect(readDatabaseClock(client as never)).resolves.toBe(now);
    expect(statement(client.$queryRaw.mock.calls[0]).text).toBe('SELECT clock_timestamp() AS "now"');
  });
});
