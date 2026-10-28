import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * Agent-first experiment (ADR 0015) — grant the `contacts:*`, `webhooks:*` and `audit:read` scopes on
 * `oauthResource` rows that already exist.
 *
 * Same repair as ENG-2862 (20260915120000), for the same reason: the plugin seeds the resource row
 * `insertOnly`, and `resolveResourcePolicy` intersects a request against `allowedScopes`, so a row left
 * at the old list silently drops the new scopes at `/authorize`. See that migration for the full
 * reasoning, including why a NULL `allowedScopes` is left alone and why one statement is enough.
 *
 * Appends only what is missing, so it is idempotent and keeps the existing order. No-op on a fresh
 * database, where the plugin seeds the full current list at first boot.
 */

const AGENT_PLATFORM_SCOPES = [
  "contacts:read",
  "contacts:write",
  "webhooks:read",
  "webhooks:write",
  "audit:read",
] as const;

export const grantAgentPlatformScopes: MigrationScript = {
  type: "data",
  id: "q4dn7xk2vb9ts3hw6ymj8ecf",
  name: "20261028100000_grant_agent_platform_scopes",
  run: async ({ tx }) => {
    const migrationTx = tx as unknown as {
      $executeRaw: (query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<number>;
    };

    const scopes = [...AGENT_PLATFORM_SCOPES];

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

    console.log(`Agent platform scope grant: ${JSON.stringify({ resourcesUpdated: Number(updated) })}`);
  },
};
