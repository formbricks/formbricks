import { PrismaPg } from "@prisma/adapter-pg";
import { cpus } from "node:os";
import { Pool, type PoolClient, type PoolConfig } from "pg";
import { logger } from "@formbricks/logger";

interface TParsedPrismaPgConfig {
  adapter: PrismaPg;
  connectionString: string;
}

const PRISMA_ONLY_PARAMS = new Set([
  "connection_limit",
  "pool_timeout",
  "connect_timeout",
  "max_idle_connection_lifetime",
  "max_connection_lifetime",
  "pgbouncer",
  "schema",
  "socket_timeout",
  "sslaccept",
  "statement_cache_size",
]);

// Strictly positive — for params where 0 makes no sense (e.g. connection pool size).
const toPositiveInt = (value: string | null): number | undefined => {
  if (value === null || value.trim() === "") {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

// Non-negative — for params where 0 has the documented meaning of "disable /
// unlimited" (e.g. connect_timeout=0 means wait indefinitely, idle lifetime=0
// means never expire). Preserves Prisma 6 semantics for these knobs.
const toNonNegativeInt = (value: string | null): number | undefined => {
  if (value === null || value.trim() === "") {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const toMillis = (seconds: number | undefined): number | undefined =>
  seconds === undefined ? undefined : seconds * 1000;

// Match Prisma 6's default connection_limit: 2 * num_logical_cpus + 1, min 2.
// pg's own default is a hardcoded 10, which silently halves pool capacity on
// 8+ core hosts. Compute once at module load; cpu count is fixed for the
// process lifetime.
const DEFAULT_CONNECTION_LIMIT = Math.max(2 * cpus().length + 1, 2);
const POSTGRES_POOL_CONNECTION_FAILED_EVENT = "postgres_pool_connection_failed";

type TConnectionFailurePhase = "acquired_connection" | "connection_establishment" | "idle_connection";

type TPoolConnectCallback = (
  error: Error | undefined,
  client: PoolClient | undefined,
  done: (release?: unknown) => void
) => void;

const getSafeErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;

  const code = error.code;
  if (typeof code !== "string" || !/^(?:[0-9A-Z]{5}|E[A-Z0-9_]{2,31})$/.test(code)) return undefined;

  return code;
};

const classifyConnectionFailure = (error: unknown): string => {
  const errorCode = getSafeErrorCode(error);
  if (errorCode === "ETIMEDOUT") return "connection_timeout";
  if (errorCode === "ECONNRESET") return "connection_reset";
  if (errorCode === "ECONNREFUSED") return "connection_refused";
  if (errorCode === "EHOSTUNREACH" || errorCode === "ENETUNREACH") return "network_unreachable";

  if (error instanceof Error && error.message === "Connection terminated due to connection timeout") {
    return "connection_timeout";
  }

  return "database_connection_error";
};

const logConnectionFailure = (
  pool: Pool,
  connectionTimeoutMillis: number,
  phase: TConnectionFailurePhase,
  error: unknown
): void => {
  const errorCode = getSafeErrorCode(error);

  logger.error(
    {
      event: POSTGRES_POOL_CONNECTION_FAILED_EVENT,
      phase,
      classification: classifyConnectionFailure(error),
      ...(errorCode !== undefined && { error_code: errorCode }),
      connection_timeout_ms: connectionTimeoutMillis,
      pool_total_connections: pool.totalCount,
      pool_idle_connections: pool.idleCount,
      pool_waiting_requests: pool.waitingCount,
    },
    "PostgreSQL pool connection failed"
  );
};

class InstrumentedPool extends Pool {
  constructor(
    config: PoolConfig,
    private readonly connectionTimeoutMillis: number
  ) {
    super(config);
  }

  connect(): Promise<PoolClient>;
  connect(callback: TPoolConnectCallback): void;
  connect(callback?: TPoolConnectCallback): Promise<PoolClient> | void {
    if (callback) {
      return super.connect((error, client, done) => {
        if (error) {
          logConnectionFailure(this, this.connectionTimeoutMillis, "connection_establishment", error);
        }
        callback(error, client, done);
      });
    }

    return super.connect().catch((error: unknown) => {
      logConnectionFailure(this, this.connectionTimeoutMillis, "connection_establishment", error);
      throw error;
    });
  }
}

const getConnectionString = (url: URL): string => {
  const sanitizedUrl = new URL(url.toString());

  PRISMA_ONLY_PARAMS.forEach((param) => {
    sanitizedUrl.searchParams.delete(param);
  });

  return sanitizedUrl.toString();
};

// Translate Prisma's sslaccept param to pg's ssl PoolConfig.
//   accept_invalid_certs → ssl: { rejectUnauthorized: false }
//   strict               → ssl: { rejectUnauthorized: true }   (enables SSL too)
//   absent               → undefined; pg honors sslmode in the URL
//   unknown value        → warn and default to strict (fail closed)
const sslConfigFromSslAccept = (value: string | null): PoolConfig["ssl"] | undefined => {
  if (value === null) return undefined;

  switch (value) {
    case "accept_invalid_certs":
      return { rejectUnauthorized: false };
    case "strict":
      return { rejectUnauthorized: true };
    default:
      logger.warn(
        { sslaccept: value },
        "Unknown sslaccept value in DATABASE_URL; defaulting to strict (rejectUnauthorized: true)"
      );
      return { rejectUnauthorized: true };
  }
};

export const createPrismaPgAdapter = (databaseUrl = process.env.DATABASE_URL): TParsedPrismaPgConfig => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to create a Prisma PostgreSQL adapter.");
  }

  if (databaseUrl.startsWith("prisma://") || databaseUrl.startsWith("prisma+postgres://")) {
    throw new Error(
      "Prisma Accelerate URLs are not supported by Formbricks' PostgreSQL adapter. Use a direct PostgreSQL DATABASE_URL."
    );
  }

  const parsedUrl = new URL(databaseUrl);
  const schema = parsedUrl.searchParams.get("schema") ?? undefined;
  // connection_limit must be strictly positive; max:0 in pg disables the pool.
  // Fall back to Prisma 6's formula so multi-core hosts keep their previous
  // capacity instead of silently dropping to pg's default of 10.
  const connectionLimit =
    toPositiveInt(parsedUrl.searchParams.get("connection_limit")) ?? DEFAULT_CONNECTION_LIMIT;
  // connect_timeout → pg's TCP-connect timeout. 0 means "wait indefinitely"
  // (Prisma 6 semantics; pg also honors this). pool_timeout (Prisma's
  // "max wait for a pooled connection") has no pg equivalent — warn instead
  // of silently misapplying it to a different knob.
  const connectTimeoutSeconds = toNonNegativeInt(parsedUrl.searchParams.get("connect_timeout"));
  const connectionTimeoutMillis = toMillis(connectTimeoutSeconds) ?? 5_000;
  const poolTimeoutRaw = parsedUrl.searchParams.get("pool_timeout");
  if (poolTimeoutRaw !== null && poolTimeoutRaw.trim() !== "") {
    logger.warn(
      { pool_timeout: poolTimeoutRaw },
      "pool_timeout in DATABASE_URL is a Prisma-only param with no pg equivalent; ignoring."
    );
  }
  // 0 = "never expire idle connections" (Prisma 6 semantics).
  const maxIdleConnectionLifetime = toMillis(
    toNonNegativeInt(parsedUrl.searchParams.get("max_idle_connection_lifetime"))
  );
  // 0 = "no max lifetime" (Prisma 6 semantics).
  const maxConnectionLifetime = toNonNegativeInt(parsedUrl.searchParams.get("max_connection_lifetime"));
  const ssl = sslConfigFromSslAccept(parsedUrl.searchParams.get("sslaccept"));
  const connectionString = getConnectionString(parsedUrl);

  const poolConfig: PoolConfig = {
    connectionString,
    connectionTimeoutMillis,
    idleTimeoutMillis: maxIdleConnectionLifetime ?? 300_000,
    max: connectionLimit,
    ...(maxConnectionLifetime !== undefined && { maxLifetimeSeconds: maxConnectionLifetime }),
    ...(ssl !== undefined && { ssl }),
  };
  const pool = new InstrumentedPool(poolConfig, connectionTimeoutMillis);

  return {
    adapter: new PrismaPg(pool, {
      ...(schema !== undefined && { schema }),
      disposeExternalPool: true,
      onPoolError: (error) => {
        logConnectionFailure(pool, connectionTimeoutMillis, "idle_connection", error);
      },
      onConnectionError: (error) => {
        logConnectionFailure(pool, connectionTimeoutMillis, "acquired_connection", error);
      },
    }),
    connectionString,
  };
};
