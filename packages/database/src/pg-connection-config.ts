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
  // Only rewrite the query: pg also accepts socket and empty-host URLs.
  const parts = databaseUrl.match(/^([^#?]*)\?([^#]*)(.*)$/s);
  const params = new URLSearchParams(parts?.[2]);
  if (!parts || !params.has("sslaccept")) {
    return { connectionString: databaseUrl };
  }

  const ssl = sslConfigFromSslAccept(params.get("sslaccept"));
  params.delete("sslaccept");
  const query = params.toString();

  return {
    connectionString: `${parts[1]}${query ? `?${query}` : ""}${parts[3]}`,
    ...(ssl !== undefined && { ssl }),
  };
};
