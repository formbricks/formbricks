import { EventEmitter } from "node:events";
import { Client, Pool, type PoolClient, type PoolConfig } from "pg";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  DEFAULT_POOL_ACQUIRE_TIMEOUT_MS,
  type TPrismaPgAdapterOptions,
  createPrismaPgAdapter,
} from "./prisma-adapter";

type TPoolConnectCallback = (
  error: Error | undefined,
  client: PoolClient | undefined,
  done: (release?: unknown) => void
) => void;

const { loggerErrorMock, loggerWarnMock } = vi.hoisted(() => ({
  loggerErrorMock: vi.fn<(context: Record<string, unknown>, message: string) => void>(),
  loggerWarnMock: vi.fn<(context: Record<string, unknown>, message: string) => void>(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: loggerErrorMock,
    warn: loggerWarnMock,
  },
}));

const pools: Pool[] = [];

const connectAdapter = async (databaseUrl: string, options?: TPrismaPgAdapterOptions) => {
  const result = createPrismaPgAdapter(databaseUrl, options);
  const adapter = await result.adapter.connect();
  const pool = adapter.underlyingDriver();
  pools.push(pool);
  return { adapter, pool, result };
};

afterEach(async () => {
  vi.restoreAllMocks();
  loggerErrorMock.mockReset();
  loggerWarnMock.mockReset();
  await Promise.all(pools.splice(0).map((pool) => (pool.ending ? Promise.resolve() : pool.end())));
});

describe("createPrismaPgAdapter", () => {
  test("creates an externally owned pool with the translated Prisma URL settings", async () => {
    const databaseUrl =
      "postgresql://app:secret@database:5432/formbricks?connection_limit=10&connect_timeout=15&schema=customer&sslaccept=strict";

    const { adapter, pool, result } = await connectAdapter(databaseUrl);

    expect(result.connectionString).toBe("postgresql://app:secret@database:5432/formbricks");
    expect(pool.options).toMatchObject({
      connectionTimeoutMillis: 15_000,
      idleTimeoutMillis: 300_000,
      max: 10,
      ssl: { rejectUnauthorized: true },
    });
    expect(adapter.getConnectionInfo()).toEqual({ schemaName: "customer", supportsRelationJoins: true });
  });

  test("logs a safe structured event when establishing a pooled connection fails", async () => {
    const sensitiveError = Object.assign(new Error("postgresql://admin:super-secret@database/formbricks"), {
      code: "ECONNRESET",
    });
    vi.spyOn(Pool.prototype, "connect").mockRejectedValueOnce(sensitiveError);

    const { pool } = await connectAdapter(
      "postgresql://app:secret@database:5432/formbricks?connect_timeout=15"
    );

    await expect(pool.connect()).rejects.toBe(sensitiveError);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      {
        event: "postgres_pool_connection_failed",
        phase: "connection_establishment",
        classification: "connection_reset",
        error_code: "ECONNRESET",
        connection_timeout_ms: 15_000,
        pool_total_connections: 0,
        pool_idle_connections: 0,
        pool_waiting_requests: 0,
      },
      "PostgreSQL pool connection failed"
    );
    expect(JSON.stringify(loggerErrorMock.mock.calls)).not.toContain("admin");
    expect(JSON.stringify(loggerErrorMock.mock.calls)).not.toContain("super-secret");
  });

  test("logs and forwards callback-style connection failures", async () => {
    const sensitiveError = Object.assign(new Error("password=super-secret"), { code: "ECONNREFUSED" });
    const done = vi.fn();
    vi.spyOn(Pool.prototype, "connect").mockImplementationOnce((callback) => {
      callback(sensitiveError, undefined, done);
    });

    const { pool } = await connectAdapter(
      "postgresql://app:secret@database:5432/formbricks?connect_timeout=15"
    );
    const callback = vi.fn<TPoolConnectCallback>();

    pool.connect(callback);

    expect(callback).toHaveBeenCalledWith(sensitiveError, undefined, done);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "connection_establishment",
        classification: "connection_refused",
        error_code: "ECONNREFUSED",
      }),
      "PostgreSQL pool connection failed"
    );
    expect(JSON.stringify(loggerErrorMock.mock.calls)).not.toContain("super-secret");
  });

  test("forwards successful callback-style connections without logging", async () => {
    const client = {} as PoolClient;
    const done = vi.fn();
    vi.spyOn(Pool.prototype, "connect").mockImplementationOnce((callback) => {
      callback(undefined, client, done);
    });

    const { pool } = await connectAdapter("postgresql://app:secret@database:5432/formbricks");
    const callback = vi.fn<TPoolConnectCallback>();

    pool.connect(callback);

    expect(callback).toHaveBeenCalledWith(undefined, client, done);
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  test.each([
    [
      "host unreachable",
      Object.assign(new Error("host unreachable"), { code: "EHOSTUNREACH" }),
      "network_unreachable",
      "EHOSTUNREACH",
    ],
    [
      "network unreachable",
      Object.assign(new Error("network unreachable"), { code: "ENETUNREACH" }),
      "network_unreachable",
      "ENETUNREACH",
    ],
    [
      "driver timeout",
      new Error("Connection terminated due to connection timeout"),
      "connection_timeout",
      undefined,
    ],
    ["unknown error", new Error("unknown database error"), "database_connection_error", undefined],
    [
      "SQLSTATE error",
      Object.assign(new Error("connection failure"), { code: "08006" }),
      "database_connection_error",
      "08006",
    ],
    [
      "invalid code",
      Object.assign(new Error("invalid code"), { code: "not-safe" }),
      "database_connection_error",
      undefined,
    ],
    [
      "non-string code",
      Object.assign(new Error("invalid code"), { code: 500 }),
      "database_connection_error",
      undefined,
    ],
    ["non-object error", "invalid error", "database_connection_error", undefined],
  ])("classifies %s safely", async (_case, error, classification, errorCode) => {
    const { pool } = await connectAdapter("postgresql://app:secret@database:5432/formbricks");

    pool.emit("error", error);

    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        classification,
      }),
      "PostgreSQL pool connection failed"
    );
    const logContext = loggerErrorMock.mock.calls[0]?.[0];
    if (errorCode === undefined) {
      expect(logContext).not.toHaveProperty("error_code");
    } else {
      expect(logContext).toHaveProperty("error_code", errorCode);
    }
  });

  test("classifies null connection rejections safely", async () => {
    vi.spyOn(Pool.prototype, "connect").mockRejectedValueOnce(null);
    const { pool } = await connectAdapter("postgresql://app:secret@database:5432/formbricks");

    await expect(pool.connect()).rejects.toBeNull();

    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        classification: "database_connection_error",
      }),
      "PostgreSQL pool connection failed"
    );
    expect(loggerErrorMock.mock.calls[0]?.[0]).not.toHaveProperty("error_code");
  });

  test("registers pool error listeners and disposes the external pool", async () => {
    const sensitiveError = Object.assign(new Error("password=super-secret"), { code: "ETIMEDOUT" });
    const { adapter, pool } = await connectAdapter("postgresql://app:secret@database:5432/formbricks");
    const endSpy = vi.spyOn(pool, "end");

    pool.emit("error", sensitiveError);

    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "postgres_pool_connection_failed",
        phase: "idle_connection",
        classification: "connection_timeout",
        error_code: "ETIMEDOUT",
        connection_timeout_ms: 5_000,
      }),
      "PostgreSQL pool connection failed"
    );
    expect(JSON.stringify(loggerErrorMock.mock.calls)).not.toContain("super-secret");

    await adapter.dispose();

    expect(endSpy).toHaveBeenCalledOnce();
  });

  test("logs acquired connection errors without serializing the raw error", async () => {
    const sensitiveError = Object.assign(new Error("password=super-secret"), { code: "ETIMEDOUT" });
    const client = Object.assign(new EventEmitter(), {
      query: vi.fn().mockResolvedValue({ rowCount: 0 }),
      release: vi.fn(),
    }) as unknown as PoolClient;
    (
      vi.spyOn(Pool.prototype, "connect") as unknown as {
        mockResolvedValueOnce: (value: PoolClient) => void;
      }
    ).mockResolvedValueOnce(client);
    const { adapter } = await connectAdapter("postgresql://app:secret@database:5432/formbricks");
    const transaction = await adapter.startTransaction();

    client.emit("error", sensitiveError);

    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "postgres_pool_connection_failed",
        phase: "acquired_connection",
        classification: "connection_timeout",
        error_code: "ETIMEDOUT",
        connection_timeout_ms: 5_000,
      }),
      "PostgreSQL pool connection failed"
    );
    expect(JSON.stringify(loggerErrorMock.mock.calls)).not.toContain("super-secret");

    await transaction.rollback();
  });

  describe("idle_in_transaction_session_timeout", () => {
    const BASE_URL = "postgresql://app:secret@database:5432/formbricks";
    const APP_DEFAULT = { idleInTransactionSessionTimeoutMillis: 60_000 };

    // What pg sends to the server at connect time, built the way pg-pool builds each client. This is
    // the end-to-end check: pg merges connection-string params over the pool options, so asserting on
    // `pool.options` alone could pass while the server is told something else.
    const startupParams = (pool: Pool): Record<string, string> =>
      (
        new Client(pool.options as PoolConfig) as unknown as { getStartupConf: () => Record<string, string> }
      ).getStartupConf();

    test("is never sent for a client that did not opt in, even when DATABASE_URL sets it", async () => {
      const { pool, result } = await connectAdapter(`${BASE_URL}?idle_in_transaction_session_timeout=5000`);

      expect(pool.options).not.toHaveProperty("idle_in_transaction_session_timeout");
      expect(startupParams(pool)).not.toHaveProperty("idle_in_transaction_session_timeout");
      // Stripped, so the migration runner (which builds its adapter here) cannot inherit it.
      expect(result.connectionString).toBe(BASE_URL);
    });

    test("applies the caller's default when DATABASE_URL does not set it", async () => {
      const { pool } = await connectAdapter(BASE_URL, APP_DEFAULT);

      expect(startupParams(pool).idle_in_transaction_session_timeout).toBe("60000");
    });

    test("lets DATABASE_URL override the default, in milliseconds", async () => {
      const { pool, result } = await connectAdapter(
        `${BASE_URL}?idle_in_transaction_session_timeout=5000`,
        APP_DEFAULT
      );

      expect(startupParams(pool).idle_in_transaction_session_timeout).toBe("5000");
      expect(result.connectionString).toBe(BASE_URL);
    });

    test("sends nothing when DATABASE_URL sets 0 — the opt-out for poolers that reject the parameter", async () => {
      const { pool } = await connectAdapter(`${BASE_URL}?idle_in_transaction_session_timeout=0`, APP_DEFAULT);

      expect(pool.options).not.toHaveProperty("idle_in_transaction_session_timeout");
      expect(startupParams(pool)).not.toHaveProperty("idle_in_transaction_session_timeout");
    });

    test.each([
      ["a unit suffix pg would misread as milliseconds", "60s"],
      ["a non-number", "abc"],
      ["a negative number", "-5"],
      ["a fraction", "1.5"],
      ["a value past Postgres's 32-bit limit", "2147483648"],
    ])("falls back to the default and warns on %s", async (_, value) => {
      const { pool } = await connectAdapter(
        `${BASE_URL}?idle_in_transaction_session_timeout=${encodeURIComponent(value)}`,
        APP_DEFAULT
      );

      expect(startupParams(pool).idle_in_transaction_session_timeout).toBe("60000");
      expect(loggerWarnMock).toHaveBeenCalledWith(
        { idle_in_transaction_session_timeout: value, default_ms: 60_000 },
        expect.stringContaining("Invalid idle_in_transaction_session_timeout")
      );
      // Never the URL: it carries the database password.
      expect(JSON.stringify(loggerWarnMock.mock.calls)).not.toContain("secret");
    });

    test("accepts Postgres's maximum", async () => {
      const { pool } = await connectAdapter(
        `${BASE_URL}?idle_in_transaction_session_timeout=2147483647`,
        APP_DEFAULT
      );

      expect(startupParams(pool).idle_in_transaction_session_timeout).toBe("2147483647");
      expect(loggerWarnMock).not.toHaveBeenCalled();
    });
  });

  describe("poolAcquireTimeoutMillis", () => {
    test.each([
      ["defaults when connect_timeout is absent", "", DEFAULT_POOL_ACQUIRE_TIMEOUT_MS],
      ["follows connect_timeout, in seconds", "?connect_timeout=15", 15_000],
      ["is 0 when connect_timeout disables the timeout", "?connect_timeout=0", 0],
    ])("%s", async (_, query, expected) => {
      const { pool, result } = await connectAdapter(
        `postgresql://app:secret@database:5432/formbricks${query}`
      );

      expect(result.poolAcquireTimeoutMillis).toBe(expected);
      // It is the value pg-pool actually queues against, not a parallel copy that could drift.
      expect(pool.options.connectionTimeoutMillis).toBe(expected);
    });
  });
});
