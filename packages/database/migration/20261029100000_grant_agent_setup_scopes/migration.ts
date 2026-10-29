import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * Agent-led setup (ADR 0018) — grant the `account:read`, `workspaces:write`, `organizations:write` and
 * `members:write` scopes on `oauthResource` rows that already exist.
 *
 * Same repair as 20261028100000 (agent platform scopes) and ENG-2862 (20260915120000), for the same
 * reason: the plugin seeds the resource row `insertOnly`, and `resolveResourcePolicy` intersects a request
 * against `allowedScopes`, so a row left at the old list silently drops the new scopes at `/authorize`.
 * See ENG-2862 for the full reasoning, including why a NULL `allowedScopes` is left alone and why one
 * statement is enough.
 *
 * Appends only what is missing, so it is idempotent and keeps the existing order. No-op on a fresh
 * database, where the plugin seeds the full current list at first boot.
 */

const AGENT_SETUP_SCOPES = [
  "account:read",
  "workspaces:write",
  "organizations:write",
  "members:write",
] as const;

export const grantAgentSetupScopes: MigrationScript = {
  type: "data",
  id: "m3vh8cx5tq2zk7bw4nyd9rpj",
  name: "20261029100000_grant_agent_setup_scopes",
  run: async ({ tx }) => {
    const migrationTx = tx as unknown as {
      $executeRaw: (query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<number>;
    };

    const scopes = [...AGENT_SETUP_SCOPES];

    const updated = await migrationTx.$executeRaw`
      UPDATE "oauthResource"
      SET "allowedScopes" = "allowedScopes" || ARRAY(
            SELECT missing
            FROM unnest(${scopes}::TEXT[]) AS missing
            WHERE NOT (missing = ANY("allowedScopes"))
          ),
          "updatedAt" = NOW()
      WHERE "identifier" LIKE '%/api/mcp'
        AND NOT ("allowedScopes" @> ${scopes}::TEXT[])
    `;

    console.log(`Agent setup scope grant: ${JSON.stringify({ resourcesUpdated: Number(updated) })}`);
  },
};
