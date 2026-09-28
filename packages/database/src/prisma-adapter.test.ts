import { Pool, type PoolClient } from "pg";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createPrismaPgAdapter } from "./prisma-adapter";

type TPrismaPgOptions = {
  disposeExternalPool?: boolean;
  onConnectionError?: (error: Error) => void;
  onPoolError?: (error: Error) => void;
  schema?: string;
};

type TPoolConnectCallback = (
  error: Error | undefined,
  client: PoolClient | undefined,
  done: (release?: unknown) => void
) => void;

const { loggerErrorMock, loggerWarnMock, prismaPgMock } = vi.hoisted(() => ({
  loggerErrorMock: vi.fn<(context: Record<string, unknown>, message: string) => void>(),
  loggerWarnMock: vi.fn<(context: Record<string, unknown>, message: string) => void>(),
  prismaPgMock: vi.fn<(pool: Pool, options: TPrismaPgOptions) => void>(),
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: prismaPgMock,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: loggerErrorMock,
    warn: loggerWarnMock,
  },
}));

const pools: Pool[] = [];

const getCreatedPool = (): Pool => {
  const pool = prismaPgMock.mock.calls[prismaPgMock.mock.calls.length - 1]?.[0];
  if (!(pool instanceof Pool)) throw new Error("Expected PrismaPg to receive a Pool instance");
  pools.push(pool);
  return pool;
};

afterEach(async () => {
  vi.restoreAllMocks();
  loggerErrorMock.mockReset();
  loggerWarnMock.mockReset();
  prismaPgMock.mockClear();
  await Promise.all(pools.splice(0).map((pool) => pool.end()));
});

describe("createPrismaPgAdapter", () => {
  test("creates an externally owned pool with the translated Prisma URL settings", () => {
    const databaseUrl =
      "postgresql://app:secret@database:5432/formbricks?connection_limit=10&connect_timeout=15&schema=customer&sslaccept=strict";

    const result = createPrismaPgAdapter(databaseUrl);
    const pool = getCreatedPool();
    const options = prismaPgMock.mock.calls[prismaPgMock.mock.calls.length - 1]?.[1];

    expect(result.connectionString).toBe("postgresql://app:secret@database:5432/formbricks");
    expect(pool.options).toMatchObject({
      connectionTimeoutMillis: 15_000,
      idleTimeoutMillis: 300_000,
      max: 10,
      ssl: { rejectUnauthorized: true },
    });
    expect(options.disposeExternalPool).toBe(true);
    expect(options.schema).toBe("customer");
    expect(typeof options.onConnectionError).toBe("function");
    expect(typeof options.onPoolError).toBe("function");
  });

  test("logs a safe structured event when establishing a pooled connection fails", async () => {
    const sensitiveError = Object.assign(new Error("postgresql://admin:super-secret@database/formbricks"), {
      code: "ECONNRESET",
    });
    vi.spyOn(Pool.prototype, "connect").mockRejectedValueOnce(sensitiveError);

    createPrismaPgAdapter("postgresql://app:secret@database:5432/formbricks?connect_timeout=15");
    const pool = getCreatedPool();

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

  test("logs and forwards callback-style connection failures", () => {
    const sensitiveError = Object.assign(new Error("password=super-secret"), { code: "ECONNREFUSED" });
    const done = vi.fn();
    vi.spyOn(Pool.prototype, "connect").mockImplementationOnce((callback) => {
      callback(sensitiveError, undefined, done);
    });

    createPrismaPgAdapter("postgresql://app:secret@database:5432/formbricks?connect_timeout=15");
    const pool = getCreatedPool();
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

  test("forwards successful callback-style connections without logging", () => {
    const client = {} as PoolClient;
    const done = vi.fn();
    vi.spyOn(Pool.prototype, "connect").mockImplementationOnce((callback) => {
      callback(undefined, client, done);
    });

    createPrismaPgAdapter("postgresql://app:secret@database:5432/formbricks");
    const pool = getCreatedPool();
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
    ["null error", null, "database_connection_error", undefined],
  ])("classifies %s safely", (_case, error, classification, errorCode) => {
    createPrismaPgAdapter("postgresql://app:secret@database:5432/formbricks");
    getCreatedPool();
    const options = prismaPgMock.mock.calls[prismaPgMock.mock.calls.length - 1]?.[1];

    options.onConnectionError?.(error as Error);

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

  test.each([
    ["onPoolError", "idle_connection"],
    ["onConnectionError", "acquired_connection"],
  ])("logs %s without serializing the raw error", (callbackName, phase) => {
    createPrismaPgAdapter("postgresql://app:secret@database:5432/formbricks");
    getCreatedPool();
    const options = prismaPgMock.mock.calls[prismaPgMock.mock.calls.length - 1]?.[1] as Record<
      string,
      (error: Error) => void
    >;
    const sensitiveError = Object.assign(new Error("password=super-secret"), { code: "ETIMEDOUT" });

    options[callbackName](sensitiveError);

    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "postgres_pool_connection_failed",
        phase,
        classification: "connection_timeout",
        error_code: "ETIMEDOUT",
        connection_timeout_ms: 5_000,
      }),
      "PostgreSQL pool connection failed"
    );
    expect(JSON.stringify(loggerErrorMock.mock.calls)).not.toContain("super-secret");
  });
});
