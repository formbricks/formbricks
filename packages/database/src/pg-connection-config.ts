import type { ClientConfig } from "pg";
import { logger } from "@formbricks/logger";

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
  const url = new URL(databaseUrl);
  const ssl = sslConfigFromSslAccept(url.searchParams.get("sslaccept"));
  url.searchParams.delete("sslaccept");

  return {
    connectionString: url.toString(),
    ...(ssl !== undefined && { ssl }),
  };
};
