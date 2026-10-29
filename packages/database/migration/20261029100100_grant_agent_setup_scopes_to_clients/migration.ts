import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * Agent-led setup (ADR 0018) — grant the `account:read`, `workspaces:write`, `organizations:write` and
 * `members:write` scopes to OAuth clients that registered before those scopes existed.
 *
 * The companion to 20261029100000, one table over, and the same repair as 20261028100100 (agent platform
 * scopes) and ENG-3470 (20261005130000): `/authorize` validates a requested scope as a subset of what the
 * client REGISTERED with, and the new scopes are advertised in `MCP_RESOURCE_SCOPES`, so a client
 * registered earlier would ask for them and get `invalid_scope`. See ENG-3470 for why registration is a
 * ceiling rather than a grant and why a `skipConsent` client is excluded.
 *
 * Mirrors what the client already holds: `account:read` goes to a client holding any MCP `:read` resource
 * scope, and the three writes to one holding any `:write` scope. Registration is only the ceiling, never
 * the grant: the person still chooses each scope on the consent screen, where `organizations:write` and
 * `members:write` start unticked, and every operation behind them re-checks the person's organization
 * role. Clients holding no MCP resource scope are not touched.
 *
 * Idempotent per scope (`NOT (scope = ANY(scopes))`), order-preserving, and atomic in the runner's
 * transaction. No-op on a fresh database.
 */

/** Frozen as of this migration: every MCP resource scope that existed before the setup scopes. */
const MCP_READ_SCOPES = [
  "surveys:read",
  "workflows:read",
  "feedbackRecords:read",
  "responses:read",
  "contacts:read",
  "webhooks:read",
  "audit:read",
] as const;
const MCP_WRITE_SCOPES = [
  "surveys:write",
  "workflows:write",
  "feedbackRecords:write",
  "responses:write",
  "contacts:write",
  "webhooks:write",
] as const;

const READ_GRANTS = ["account:read"] as const;
const WRITE_GRANTS = ["workspaces:write", "organizations:write", "members:write"] as const;

export const grantAgentSetupScopesToClients: MigrationScript = {
  type: "data",
  id: "h6tq1ws9ye4mx8cv3jfz5kbn",
  name: "20261029100100_grant_agent_setup_scopes_to_clients",
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

    console.log(`Agent setup client scope grant: ${JSON.stringify(added)}`);
  },
};
