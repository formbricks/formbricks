import type { ClientConfig } from "pg";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ONLINE_INDEXES, ensureOnlineIndexes } from "./online-indexes";

const { connect, query, end, createClient } = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
  createClient: vi.fn<(config: ClientConfig) => void>(),
}));

vi.mock("pg", () => ({
  Client: class {
    connect = connect;
    query = query;
    end = end;
    constructor(config: ClientConfig) {
      createClient(config);
    }
  },
}));

describe("online index builds", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("honors sslaccept on the dedicated index connection", async () => {
    const failure = new Error("stop after connection configuration");
    connect.mockRejectedValueOnce(failure);

    await expect(
      ensureOnlineIndexes("postgresql://app:secret@database/formbricks?sslaccept=accept_invalid_certs")
    ).rejects.toBe(failure);

    expect(createClient).toHaveBeenCalledWith({
      connectionString: "postgresql://app:secret@database/formbricks",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10_000,
    });
    expect(end).toHaveBeenCalledOnce();
  });

  test("allows older transactions to drain without a short lock timeout and validates each build", async () => {
    const seen = new Set<string>();
    query.mockImplementation((_sql: string, values?: string[]) => {
      if (_sql.includes("pg_try_advisory_lock")) return Promise.resolve({ rows: [{ acquired: true }] });
      const index = ONLINE_INDEXES.find(({ name }) => name === values?.[0]);
      if (!index) return Promise.resolve({ rows: [] });
      if (!seen.has(index.name)) {
        seen.add(index.name);
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({
        rows: [
          { ...index, simple: true, valid: true, unique: !!index.unique, predicate: index.predicate ?? null },
        ],
      });
    });

    await ensureOnlineIndexes("postgresql://test");

    expect(query).toHaveBeenNthCalledWith(1, "SET lock_timeout = 0");
    const statements = query.mock.calls.map(([sql]) => sql as string);
    expect(statements.filter((sql) => /^CREATE (UNIQUE )?INDEX CONCURRENTLY/.test(sql))).toHaveLength(
      ONLINE_INDEXES.length
    );
    expect(statements.some((sql) => /^BEGIN/i.test(sql))).toBe(false);
    expect(statements[1]).toContain("pg_try_advisory_lock");
    expect(end).toHaveBeenCalledOnce();
  });

  test("closes the dedicated connection when a build fails", async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error("connection lost"));

    await expect(ensureOnlineIndexes("postgresql://test")).rejects.toThrow("connection lost");
    expect(end).toHaveBeenCalledOnce();
  });
});
