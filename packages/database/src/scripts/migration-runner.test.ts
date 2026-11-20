import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, expectTypeOf, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import {
  type AutocommitDataMigrationContext,
  type AutocommitDataMigrationScript,
  type DataMigrationContext,
  type MigrationScript,
  runDataMigration,
} from "./migration-runner";

const { queryRaw, executeRaw, transaction, txQueryRaw, txExecuteRaw, lockQuery, lockEnd, lockClients } =
  vi.hoisted(() => {
    // The runner reads its database URL when the module loads.
    process.env.DATABASE_URL = "postgresql://runner-test";
    return {
      queryRaw: vi.fn(),
      executeRaw: vi.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<number>>(),
      transaction: vi.fn(),
      txQueryRaw: vi.fn(),
      txExecuteRaw: vi.fn(),
      lockQuery: vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>>(),
      lockEnd: vi.fn<() => Promise<void>>(),
      lockClients: [] as EventEmitter[],
    };
  });

// The advisory lock's dedicated connection. Emitting "end" on it simulates a dropped connection.
vi.mock("pg", () => ({
  Client: class extends EventEmitter {
    connect = vi.fn().mockResolvedValue(undefined);
    query = lockQuery;
    end = lockEnd;
    constructor() {
      super();
      lockClients.push(this);
    }
  },
}));
vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../prisma-adapter", () => ({ createPrismaPgAdapter: () => ({ adapter: {} }) }));
vi.mock("./online-indexes", () => ({ ensureOnlineIndexes: vi.fn() }));
vi.mock("../prisma", () => ({
  Prisma: {},
  PrismaClient: class {
    $queryRaw = queryRaw;
    $executeRaw = executeRaw;
    $transaction = transaction;
  },
}));

const ID = "migration-id";

// The status each bookkeeping statement on the lock's session writes: the INSERT's VALUES or an UPDATE's SET.
const writtenStatuses = (): string[] =>
  lockQuery.mock.calls.flatMap(([sql]) => {
    const statement = sql.replaceAll(/\s+/g, " ");
    return (
      statement
        .match(/VALUES \(\$1, \$2, '(\w+)'|SET status = '(\w+)'/)
        ?.slice(1)
        .filter(Boolean) ?? []
    );
  });

const lockStatements = (fragment: string) =>
  lockQuery.mock.calls.filter(([sql]) => sql.includes(fragment)).length;

// The lock connection answers like Postgres: the try-lock, the heartbeat's "still held" check, the unlock.
const answerLockQueries = (locked: boolean) =>
  lockQuery.mockImplementation((sql) => {
    if (sql.includes("pg_try_advisory_lock")) return Promise.resolve({ rows: [{ pid: 7, locked }] });
    if (sql.includes("AS held")) return Promise.resolve({ rows: [{ held: true }] });
    return Promise.resolve({ rows: [] });
  });

const autocommitMigration = (
  run: (context: AutocommitDataMigrationContext) => Promise<void>
): AutocommitDataMigrationScript => ({
  type: "data",
  id: ID,
  name: "autocommit_migration",
  transactional: false,
  run,
});

describe("runDataMigration with transactional: false", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lockClients.length = 0;
    queryRaw.mockResolvedValue([]);
    executeRaw.mockResolvedValue(1);
    answerLockQueries(true);
    lockEnd.mockResolvedValue(undefined);
  });

  test("runs outside any transaction and hands run() the autocommit client and an abort signal", async () => {
    const run = vi
      .fn<(context: AutocommitDataMigrationContext) => Promise<void>>()
      .mockResolvedValue(undefined);

    await runDataMigration(autocommitMigration(run));

    expect(transaction).not.toHaveBeenCalled();
    expect(Object.keys(run.mock.calls[0][0]).sort()).toEqual(["prisma", "signal"]);
    // Status writes go through the lock's session only, never Prisma's pool.
    expect(writtenStatuses()).toEqual(["pending", "applied"]);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  test("commits the pending marker before run() starts, so other runners can see it", async () => {
    let statusesWhenRunStarted: string[] = [];

    await runDataMigration(
      autocommitMigration(() => {
        statusesWhenRunStarted = writtenStatuses();
        return Promise.resolve();
      })
    );

    expect(statusesWhenRunStarted).toEqual(["pending"]);
  });

  test("holds the migration's lock for the whole run, then releases it", async () => {
    let unlocksDuringRun = -1;

    await runDataMigration(
      autocommitMigration(() => {
        unlocksDuringRun = lockStatements("pg_advisory_unlock");
        return Promise.resolve();
      })
    );

    expect(lockStatements("pg_try_advisory_lock")).toBe(1);
    expect(unlocksDuringRun).toBe(0);
    expect(lockStatements("pg_advisory_unlock")).toBe(1);
    expect(lockEnd).toHaveBeenCalledOnce();
  });

  test("marks the migration failed, releases the lock and rethrows when run() throws", async () => {
    const error = new Error("chunk failed");

    await expect(runDataMigration(autocommitMigration(() => Promise.reject(error)))).rejects.toBe(error);

    expect(writtenStatuses()).toEqual(["pending", "failed"]);
    expect(lockEnd).toHaveBeenCalledOnce();
  });

  test("logs a failed run by its name and frames, never its message", async () => {
    const secret = "respondent@example.com";

    await expect(
      runDataMigration(autocommitMigration(() => Promise.reject(new Error(`duplicate ${secret}`))))
    ).rejects.toThrow(secret);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errName: "Error" }),
      expect.any(String)
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(secret);
  });

  test("rethrows run()'s own error when marking the migration failed also fails", async () => {
    const error = new Error("chunk failed");
    lockQuery.mockImplementation((sql) => {
      if (sql.includes("pg_try_advisory_lock")) return Promise.resolve({ rows: [{ pid: 7, locked: true }] });
      if (sql.includes("'failed'")) return Promise.reject(new Error("connection terminated"));
      return Promise.resolve({ rows: [] });
    });

    await expect(runDataMigration(autocommitMigration(() => Promise.reject(error)))).rejects.toBe(error);
  });

  test("skips an applied migration without taking its lock, so replicas starting together don't race", async () => {
    queryRaw.mockResolvedValue([{ status: "applied" }]);
    const run = vi.fn();

    await runDataMigration(autocommitMigration(run));

    expect(run).not.toHaveBeenCalled();
    expect(writtenStatuses()).toEqual([]);
    expect(lockClients).toHaveLength(0);
  });

  test("skips a migration another runner finished while this one waited for the lock", async () => {
    queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ status: "applied" }]);
    const run = vi.fn();

    await runDataMigration(autocommitMigration(run));

    expect(run).not.toHaveBeenCalled();
    expect(writtenStatuses()).toEqual([]);
    expect(lockEnd).toHaveBeenCalledOnce();
  });

  test("resumes a pending migration whose runner died, since nobody holds its lock", async () => {
    queryRaw.mockResolvedValue([{ status: "pending" }]);
    const run = vi
      .fn<(context: AutocommitDataMigrationContext) => Promise<void>>()
      .mockResolvedValue(undefined);

    await runDataMigration(autocommitMigration(run));

    expect(run).toHaveBeenCalledOnce();
    expect(writtenStatuses()).toEqual(["pending", "applied"]);
  });

  test("retries a failed migration from pending", async () => {
    queryRaw.mockResolvedValue([{ status: "failed" }]);
    const run = vi
      .fn<(context: AutocommitDataMigrationContext) => Promise<void>>()
      .mockResolvedValue(undefined);

    await runDataMigration(autocommitMigration(run));

    expect(run).toHaveBeenCalledOnce();
    expect(writtenStatuses()).toEqual(["pending", "applied"]);
  });

  describe("while another process holds the migration's lock", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    test("waits, then skips once that runner has finished the migration", async () => {
      answerLockQueries(false);
      queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ status: "pending" }])
        .mockResolvedValue([{ status: "applied" }]);
      const run = vi.fn();

      const result = runDataMigration(autocommitMigration(run));
      await vi.advanceTimersByTimeAsync(5_000);
      await result;

      expect(lockStatements("pg_try_advisory_lock")).toBe(2);
      expect(run).not.toHaveBeenCalled();
      expect(writtenStatuses()).toEqual([]);
    });

    test("waits, then takes over once the lock frees without the migration being finished", async () => {
      answerLockQueries(true);
      lockQuery.mockResolvedValueOnce({ rows: [{ pid: 7, locked: false }] });
      queryRaw.mockResolvedValue([{ status: "pending" }]);
      const run = vi
        .fn<(context: AutocommitDataMigrationContext) => Promise<void>>()
        .mockResolvedValue(undefined);

      const result = runDataMigration(autocommitMigration(run));
      await vi.advanceTimersByTimeAsync(5_000);
      await result;

      expect(run).toHaveBeenCalledOnce();
      expect(writtenStatuses()).toEqual(["pending", "applied"]);
    });

    test("gives up after 30 minutes without running anything", async () => {
      answerLockQueries(false);
      queryRaw.mockResolvedValue([{ status: "pending" }]);
      const run = vi.fn();

      // Caught up front, so the rejection is handled while the fake clock runs.
      const outcome = runDataMigration(autocommitMigration(run)).catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 5_000);

      const error = await outcome;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("still running in another process after 30 minutes");

      expect(run).not.toHaveBeenCalled();
      expect(writtenStatuses()).toEqual([]);
    });
  });

  test("aborts run() and records nothing when the lock connection drops, since another runner may take over", async () => {
    let signalAborted = false;

    await expect(
      runDataMigration(
        autocommitMigration(({ signal }) => {
          lockClients[0].emit("end");
          signalAborted = signal.aborted;
          return Promise.resolve();
        })
      )
    ).rejects.toThrow("lost its lock");

    expect(signalAborted).toBe(true);
    expect(writtenStatuses()).toEqual(["pending"]);
  });

  test("autocommit migrations are not typed to receive a transaction handle", () => {
    const migration: AutocommitDataMigrationScript = {
      type: "data",
      id: ID,
      name: "no_tx",
      transactional: false,
      // @ts-expect-error `tx` only exists on the default, transactional context
      run: ({ tx }) => Promise.resolve(void tx),
    };

    expect(migration.transactional).toBe(false);
  });
});

describe("runDataMigration by default", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txQueryRaw.mockResolvedValue([]);
    txExecuteRaw.mockResolvedValue(1);
    transaction.mockImplementation((callback: (tx: unknown) => Promise<void>) =>
      callback({ $queryRaw: txQueryRaw, $executeRaw: txExecuteRaw })
    );
  });

  test("keeps run() and the bookkeeping inside one 30-minute transaction", async () => {
    const run = vi.fn<(context: object) => Promise<void>>().mockResolvedValue(undefined);

    await runDataMigration({ type: "data", id: ID, name: "default_migration", run });

    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 30 * 60 * 1000 });
    expect(Object.keys(run.mock.calls[0][0]).sort()).toEqual(["prisma", "tx"]);
    expect(txExecuteRaw).toHaveBeenCalledTimes(2);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  test("keeps one run() signature, so callers of an existing migration pass only prisma and tx", () => {
    expectTypeOf<NonNullable<MigrationScript["run"]>>().parameter(0).toEqualTypeOf<DataMigrationContext>();
  });
});
