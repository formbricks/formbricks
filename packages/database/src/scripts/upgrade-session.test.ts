import { EventEmitter } from "node:events";
import type { ClientConfig } from "pg";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  applyOnlineSchemaMigrations,
  openUpgradeSession,
  readOnlineUpgradeCheckpoint,
} from "./upgrade-session";

const { connect, query, end, clients, createClient } = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>>(),
  end: vi.fn(),
  clients: [] as EventEmitter[],
  createClient: vi.fn<(config: ClientConfig) => void>(),
}));
vi.mock("pg", () => ({
  Client: class extends EventEmitter {
    connect = connect;
    query = query;
    end = end;
    constructor(config: ClientConfig) {
      super();
      createClient(config);
      clients.push(this);
    }
  },
}));

const url = "postgresql://fixture@localhost/test";
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  clients.length = 0;
  connect.mockResolvedValue(undefined);
  end.mockResolvedValue(undefined);
  query.mockResolvedValue({ rows: [] });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

const acquire = async () => {
  query.mockResolvedValueOnce({ rows: [{ pid: 42, locked: true }] });
  return openUpgradeSession(url);
};

describe("dedicated coordinator session", () => {
  test("honors sslaccept on the coordinator connection", async () => {
    query.mockResolvedValueOnce({ rows: [{ pid: 42, locked: true }] });
    const session = await openUpgradeSession(`${url}?sslaccept=accept_invalid_certs`);

    expect(createClient).toHaveBeenCalledWith({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10_000,
    });
    await session.close();
  });

  test("refuses a competing coordinator and closes its connection", async () => {
    query.mockResolvedValueOnce({ rows: [{ pid: 42, locked: false }] });
    await expect(openUpgradeSession(url)).rejects.toThrow("upgrade_already_running");
    expect(end).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  test.each(["connect", "lock query"])("closes the connection after a failed %s", async (stage) => {
    const failure = new Error("database unavailable");
    (stage === "connect" ? connect : query).mockRejectedValueOnce(failure);
    await expect(openUpgradeSession(url)).rejects.toBe(failure);
    expect(end).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  test("checks session identity and aborts when the advisory lock disappears", async () => {
    const session = await acquire();
    query.mockResolvedValueOnce({ rows: [{ held: true }] });
    await session.assertLock();
    expect(query.mock.calls[1][1]?.[0]).toBe(42);
    expect(session.signal.aborted).toBe(false);
    query.mockResolvedValueOnce({ rows: [{ held: false }] });
    await expect(session.assertLock()).rejects.toThrow("upgrade_lock_lost");
    expect(session.signal.aborted).toBe(true);
    query.mockClear();
    await expect(session.assertLock()).rejects.toThrow("upgrade_lock_lost");
    expect(query).not.toHaveBeenCalled();
    await session.close();
    expect(vi.getTimerCount()).toBe(0);
  });

  test.each(["error", "end"])("immediately aborts on a connection %s event", async (event) => {
    const session = await acquire();
    clients[0].emit(event, new Error("connection lost"));
    expect(session.signal.aborted).toBe(true);
    await expect(session.assertLock()).rejects.toThrow("upgrade_lock_lost");
    await session.close();
  });

  test("the heartbeat aborts an idle coordinator when its connection fails", async () => {
    const session = await acquire();
    query.mockRejectedValueOnce(new Error("connection lost"));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(session.signal.aborted).toBe(true);
    await session.close();
    expect(vi.getTimerCount()).toBe(0);
  });

  test("closes the connection even when advisory unlock fails", async () => {
    const session = await acquire();
    query.mockRejectedValueOnce(new Error("unlock failed"));
    await expect(session.close()).rejects.toThrow("unlock failed");
    expect(end).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("transactional schema checkpoints", () => {
  const migration = {
    name: "fixture",
    checksum: "expected-checksum",
    sql: 'ALTER TABLE "Fixture" ADD COLUMN ready boolean',
  };
  const fixture = () => ({
    client: { query } as unknown as Awaited<ReturnType<typeof openUpgradeSession>>["client"],
    assertLock: vi.fn().mockResolvedValue(undefined),
    signal: new AbortController().signal,
    close: vi.fn(),
  });

  test("commits DDL and its history record together after checking the lock again", async () => {
    const session = fixture();
    await applyOnlineSchemaMigrations(session, [migration]);
    const statements = query.mock.calls.map(([sql]) => sql);
    expect(statements[1]).toBe("BEGIN");
    expect(statements[2]).toContain("SET LOCAL lock_timeout = '1s'");
    expect(statements[3]).toBe(migration.sql);
    expect(statements[4]).toContain("INSERT INTO _prisma_migrations");
    expect(query.mock.calls[4][1]).toEqual([migration.checksum, migration.name]);
    expect(statements[5]).toBe("COMMIT");
    expect(session.assertLock).toHaveBeenCalledTimes(2);
  });

  test("skips identical applied history but rejects a changed checksum before DDL", async () => {
    query.mockResolvedValueOnce({ rows: [{ checksum: migration.checksum }] });
    await applyOnlineSchemaMigrations(fixture(), [migration]);
    expect(query).toHaveBeenCalledTimes(1);
    query.mockClear().mockResolvedValueOnce({ rows: [{ checksum: "different" }] });
    await expect(applyOnlineSchemaMigrations(fixture(), [migration])).rejects.toThrow(
      "divergent_schema_history"
    );
    expect(query).toHaveBeenCalledTimes(1);
  });

  test.each(["DDL", "lock"])("rolls back without recording history after %s failure", async (stage) => {
    const session = fixture();
    const failure = new Error("migration interrupted");
    if (stage === "DDL") {
      query.mockImplementation((sql: string) =>
        sql === migration.sql ? Promise.reject(failure) : Promise.resolve({ rows: [] })
      );
    } else {
      session.assertLock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(failure);
    }
    await expect(applyOnlineSchemaMigrations(session, [migration])).rejects.toBe(failure);
    const statements = query.mock.calls.map(([sql]) => sql);
    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
    expect(statements.some((sql) => sql.includes("INSERT INTO _prisma_migrations"))).toBe(false);
  });
});

describe("read-only status connection", () => {
  test("honors sslaccept on the status connection without changing its timeouts", async () => {
    query.mockResolvedValueOnce({ rows: [{ exists: false }] });
    await expect(
      readOnlineUpgradeCheckpoint(`${url}?sslaccept=accept_invalid_certs`, "6.1")
    ).resolves.toBeNull();

    expect(createClient).toHaveBeenCalledWith({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10_000,
      statement_timeout: 10_000,
    });
    expect(end).toHaveBeenCalledOnce();
  });

  test("returns an absent checkpoint before installation without taking the coordinator lock", async () => {
    query.mockResolvedValueOnce({ rows: [{ exists: false }] });
    await expect(readOnlineUpgradeCheckpoint(url, "6.1")).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledOnce();
  });

  test.each([{ rows: [] }, { rows: [{ phase: "finalizing" }] }])(
    "reads the durable checkpoint and closes the connection",
    async ({ rows }) => {
      query.mockResolvedValueOnce({ rows: [{ exists: true }] }).mockResolvedValueOnce({ rows });
      await expect(readOnlineUpgradeCheckpoint(url, "6.1")).resolves.toEqual(rows[0] ?? null);
      expect(query.mock.calls[1][1]).toEqual(["6.1"]);
      expect(query.mock.calls.some(([sql]) => sql.includes("advisory"))).toBe(false);
      expect(end).toHaveBeenCalledOnce();
    }
  );

  test("closes a failed status connection and preserves the failure", async () => {
    const failure = new Error("status unavailable");
    query.mockRejectedValueOnce(failure);
    await expect(readOnlineUpgradeCheckpoint(url, "6.1")).rejects.toBe(failure);
    expect(end).toHaveBeenCalledOnce();
  });
});
