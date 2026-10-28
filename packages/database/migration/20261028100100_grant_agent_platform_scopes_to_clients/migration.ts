import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * Agent-first experiment (ADR 0015) — grant the `contacts:*`, `webhooks:*` and `audit:read` scopes to
 * OAuth clients that registered before those scopes existed.
 *
 * The companion to 20261028100000, one table over, and the same repair as ENG-3470 (20261005130000):
 * `/authorize` validates a requested scope as a subset of what the client REGISTERED with, and the new
 * scopes are advertised in `MCP_RESOURCE_SCOPES`, so a client registered earlier would ask for them and
 * get `invalid_scope`. See ENG-3470 for why registration is a ceiling rather than a grant and why a
 * `skipConsent` client is excluded.
 *
 * Mirrors what the client already holds: `:read` scopes go to a client holding any MCP `:read` resource
 * scope, `:write` scopes to one holding any `:write` scope. `audit:read` is read-only and follows the
 * read rule. Clients holding no MCP resource scope are not touched.
 *
 * Idempotent per scope (`NOT (scope = ANY(scopes))`), order-preserving, and atomic in the runner's
 * transaction. No-op on a fresh database.
 */

/** Frozen as of this migration: the MCP resource scopes before the agent platform families existed. */
const MCP_READ_SCOPES = ["surveys:read", "workflows:read", "feedbackRecords:read", "responses:read"] as const;
const MCP_WRITE_SCOPES = [
  "surveys:write",
  "workflows:write",
  "feedbackRecords:write",
  "responses:write",
] as const;

const READ_GRANTS = ["contacts:read", "webhooks:read", "audit:read"] as const;
const WRITE_GRANTS = ["contacts:write", "webhooks:write"] as const;

export const grantAgentPlatformScopesToClients: MigrationScript = {
  type: "data",
  id: "b8rw3yd6hn1fq5xk9tzc2mjv",
  name: "20261028100100_grant_agent_platform_scopes_to_clients",
  run: async ({ tx }) => {
    const migrationTx = tx as unknown as {
      $executeRaw: (query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<number>;
    };

    const readScopes = [...MCP_READ_SCOPES];
    const writeScopes = [...MCP_WRITE_SCOPES];

    const added: Record<string, number> = {};

    for (const scope of READ_GRANTS) {
      const updated = await migrationTx.$executeRaw`
        UPDATE "oauthClient"
        SET "scopes" = "scopes" || ARRAY[${scope}]::TEXT[],
            "updatedAt" = NOW()
        WHERE "scopes" && ${readScopes}::TEXT[]
          AND NOT (${scope} = ANY("scopes"))
          AND "skipConsent" IS NOT TRUE
      `;
      added[scope] = Number(updated);
    }

    for (const scope of WRITE_GRANTS) {
      const updated = await migrationTx.$executeRaw`
        UPDATE "oauthClient"
        SET "scopes" = "scopes" || ARRAY[${scope}]::TEXT[],
            "updatedAt" = NOW()
        WHERE "scopes" && ${writeScopes}::TEXT[]
          AND NOT (${scope} = ANY("scopes"))
          AND "skipConsent" IS NOT TRUE
      `;
      added[scope] = Number(updated);
    }

    console.log(`Agent platform client scope grant: ${JSON.stringify(added)}`);
  },
};
