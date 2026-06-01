import { PrismaPg } from "@prisma/adapter-pg";
import type { PoolConfig } from "pg";
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

const toPositiveInt = (value: string | null): number | undefined => {
  if (value === null || value.trim() === "") {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const toMillis = (seconds: number | undefined): number | undefined =>
  seconds === undefined ? undefined : seconds * 1000;

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
  const connectionLimit = toPositiveInt(parsedUrl.searchParams.get("connection_limit"));
  // connect_timeout → pg's TCP-connect timeout. pool_timeout (Prisma's
  // "max wait for a pooled connection") has no pg equivalent — warn instead of
  // silently misapplying it to a different knob.
  const connectionTimeoutMillis =
    toMillis(toPositiveInt(parsedUrl.searchParams.get("connect_timeout"))) ?? 5_000;
  const poolTimeoutRaw = parsedUrl.searchParams.get("pool_timeout");
  if (poolTimeoutRaw !== null && poolTimeoutRaw.trim() !== "") {
    logger.warn(
      { pool_timeout: poolTimeoutRaw },
      "pool_timeout in DATABASE_URL is a Prisma-only param with no pg equivalent; ignoring."
    );
  }
  const maxIdleConnectionLifetime = toMillis(
    toPositiveInt(parsedUrl.searchParams.get("max_idle_connection_lifetime"))
  );
  const maxConnectionLifetime = toPositiveInt(parsedUrl.searchParams.get("max_connection_lifetime"));
  const ssl = sslConfigFromSslAccept(parsedUrl.searchParams.get("sslaccept"));
  const connectionString = getConnectionString(parsedUrl);

  const poolConfig: PoolConfig = {
    connectionString,
    connectionTimeoutMillis,
    idleTimeoutMillis: maxIdleConnectionLifetime ?? 300_000,
    ...(connectionLimit !== undefined && { max: connectionLimit }),
    ...(maxConnectionLifetime !== undefined && { maxLifetimeSeconds: maxConnectionLifetime }),
    ...(ssl !== undefined && { ssl }),
  };

  return {
    adapter: new PrismaPg(poolConfig, schema ? { schema } : undefined),
    connectionString,
  };
};
