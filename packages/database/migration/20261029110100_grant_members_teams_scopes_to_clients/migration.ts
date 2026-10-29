import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * Agent-led setup, round 3 (ADR 0018) — grant the `members:read`, `teams:read` and `teams:write` scopes to
 * OAuth clients that registered before those scopes existed.
 *
 * The companion to 20261029110000, one table over, and the same repair as 20261029100100 (agent setup
 * scopes), 20261028100100 (agent platform scopes) and ENG-3470 (20261005130000): `/authorize` validates a
 * requested scope as a subset of what the client REGISTERED with, and the new scopes are advertised in
 * `MCP_RESOURCE_SCOPES`, so a client registered earlier would ask for them and get `invalid_scope`. See
 * ENG-3470 for why registration is a ceiling rather than a grant and why a `skipConsent` client is excluded.
 *
 * Mirrors what the client already holds: `members:read` and `teams:read` go to a client holding any MCP
 * `:read` resource scope, `teams:write` to one holding any `:write` scope. (`members:write` was granted to
 * write-holding clients by 20261029100100 and is not repeated here.) Registration is only the ceiling,
 * never the grant: the person still chooses each scope on the consent screen, where all three start
 * unticked, and every operation behind them re-checks the person's organization role and, for teams, the
 * Enterprise licence. Clients holding no MCP resource scope are not touched.
 *
 * Idempotent per scope (`NOT (scope = ANY(scopes))`), order-preserving, and atomic in the runner's
 * transaction. No-op on a fresh database.
 */

/**
 * Frozen as of this migration: every MCP resource scope that existed before `members:read`, `teams:read`
 * and `teams:write`. `account:read` is a read and `workspaces:write`, `organizations:write` and
 * `members:write` are writes, so a client that holds only a setup scope still counts.
 */
const MCP_READ_SCOPES = [
  "surveys:read",
  "workflows:read",
  "feedbackRecords:read",
  "responses:read",
  "contacts:read",
  "webhooks:read",
  "audit:read",
  "account:read",
] as const;
const MCP_WRITE_SCOPES = [
  "surveys:write",
  "workflows:write",
  "feedbackRecords:write",
  "responses:write",
  "contacts:write",
  "webhooks:write",
  "workspaces:write",
  "organizations:write",
  "members:write",
] as const;

const READ_GRANTS = ["members:read", "teams:read"] as const;
const WRITE_GRANTS = ["teams:write"] as const;

export const grantMembersTeamsScopesToClients: MigrationScript = {
  type: "data",
  id: "d2yk7rm5xv9ph4sw8tcn3zqb",
  name: "20261029110100_grant_members_teams_scopes_to_clients",
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

    console.log(`Members and teams client scope grant: ${JSON.stringify(added)}`);
  },
};
