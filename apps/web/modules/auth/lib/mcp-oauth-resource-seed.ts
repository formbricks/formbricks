import "server-only";
import { createId } from "@paralleldrive/cuid2";
import type { BetterAuthPlugin } from "better-auth";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "./oauth-urls";

const DEFERRED_PRISMA_ERROR_CODES = new Set(["P1003", "P2021"]);
const DEFERRED_POSTGRES_ERROR_CODES = new Set(["3D000", "42P01"]);

type TStructuredDatabaseError = Readonly<{
  code?: unknown;
  message?: unknown;
  meta?: Readonly<{
    driverAdapterError?: Readonly<{
      cause?: Readonly<{
        originalCode?: unknown;
      }>;
    }>;
  }>;
}>;

/**
 * Better Auth can be initialized while a production image is being built, before the target database
 * exists, and before migrations in a newly deployed environment create `oauthResource`. Those two
 * cases must defer to the runtime initialization. Connectivity and permission errors remain fatal.
 */
export const isDeferredMcpOauthResourceSeedError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const databaseError = error as TStructuredDatabaseError;
  if (typeof databaseError.code === "string" && DEFERRED_PRISMA_ERROR_CODES.has(databaseError.code)) {
    return true;
  }

  const originalCode = databaseError.meta?.driverAdapterError?.cause?.originalCode;
  if (typeof originalCode === "string" && DEFERRED_POSTGRES_ERROR_CODES.has(originalCode)) {
    return true;
  }

  return (
    typeof databaseError.message === "string" &&
    /(database .* does not exist|table .* does not exist|relation .* does not exist)/i.test(
      databaseError.message
    )
  );
};

/**
 * Atomically establishes the MCP OAuth resource before Better Auth's oauth-provider plugin runs.
 *
 * oauth-provider@1.7.0 implements insert-only seeding as a read followed by an insert. Its duplicate
 * handling relies on the adapter error message containing "unique" or "duplicate". The Prisma
 * adapter does not guarantee that text, so concurrent application instances starting against a fresh
 * database can race and one request receives a 500. A single PostgreSQL INSERT .. ON CONFLICT closes
 * that gap while retaining insert-only semantics: operator edits to an existing resource are never
 * overwritten.
 */
export const mcpOauthResourceSeedPlugin = {
  id: "formbricks-mcp-oauth-resource-seed",
  init: async () => {
    try {
      await prisma.$executeRaw`
        INSERT INTO "oauthResource" (
          "id",
          "identifier",
          "name",
          "allowedScopes",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${createId()},
          ${getMcpResourceUrl()},
          'Formbricks MCP',
          ${[...MCP_OAUTH_SCOPES]}::TEXT[],
          NOW(),
          NOW()
        )
        ON CONFLICT ("identifier") DO NOTHING
      `;
    } catch (error) {
      if (isDeferredMcpOauthResourceSeedError(error)) {
        logger.debug("MCP OAuth resource table is not ready; deferring resource initialization");
        return;
      }

      throw error;
    }
  },
} satisfies BetterAuthPlugin;
