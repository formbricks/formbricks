import type { ClientConfig } from "pg";
import { logger } from "@formbricks/logger";
import {
  SSLACCEPT_CONFLICT_MESSAGE,
  hasConflictingValues,
  joinConnectionUrl,
  lastParam,
  splitConnectionUrl,
} from "./connection-url";

// Prisma's sslaccept enables TLS; native pg URL settings retain their usual precedence.
const sslConfigFromSslAccept = (value: string | null): ClientConfig["ssl"] | undefined => {
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

/** Translate Prisma's TLS setting without changing pg's other URL or environment settings. */
export const getPgConnectionConfig = (
  databaseUrl: string
): { connectionString: string; ssl?: ClientConfig["ssl"] } => {
  // Only rewrite the query: pg also accepts socket and empty-host URLs.
  const parts = splitConnectionUrl(databaseUrl);
  if (!parts.params.has("sslaccept")) {
    return { connectionString: databaseUrl };
  }

  // The last value would win silently, possibly the weaker one, so a conflict fails closed. The message never holds
  // the URL.
  if (hasConflictingValues(parts.params, "sslaccept")) {
    throw new Error(SSLACCEPT_CONFLICT_MESSAGE);
  }
  const ssl = sslConfigFromSslAccept(lastParam(parts.params, "sslaccept"));
  parts.params.delete("sslaccept");

  return {
    connectionString: joinConnectionUrl(parts),
    ...(ssl !== undefined && { ssl }),
  };
};
