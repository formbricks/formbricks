import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * ENG-6581 — grant `dashboards:*` to OAuth clients registered before those scopes existed.
 *
 * The companion to 20261022120000, one table over, exactly as ENG-3470 (20261005130000) was for
 * `responses:*`: `/authorize` validates a request as a subset of the scopes a client REGISTERED with, and
 * every spec-following MCP client asks for what the protected-resource metadata advertises — which now
 * includes the dashboards pair. Without this, every integration registered before today gets
 * `invalid_scope` as its connection re-authorizes.
 *
 * **Mirrors what the client already holds.** `dashboards:read` goes to a client holding any MCP `:read`
 * resource scope, `dashboards:write` to one holding any MCP `:write` scope, so a client that registered
 * read-only stays read-only. A client holding no MCP resource scope is not touched.
 *
 * **Registration is a ceiling, not a grant.** A token still carries only what the user approves, the
 * provider re-prompts whenever the stored consent does not cover the request, and a refresh is bounded by
 * the original grant. Net effect for an existing integration: one consent screen naming the dashboard
 * scopes the next time it authorizes.
 *
 * **Except a `skipConsent` client, which is excluded:** the provider issues such a client a code before
 * any consent check, so widening its registration would grant dashboard access with no prompt.
 * `clientCredentialsScopes` is left alone; that grant refuses user-delegated scopes in any case.
 *
 * One statement per scope over a small table (one row per registered integration), each idempotent via
 * `NOT (scope = ANY(scopes))` and run inside the runner's transaction. No-op on a fresh database.
 */

/** Frozen as of this migration: the MCP resource scopes before the dashboards pair existed. */
const MCP_READ_SCOPES = ["surveys:read", "workflows:read", "feedbackRecords:read", "responses:read"] as const;
const MCP_WRITE_SCOPES = [
  "surveys:write",
  "workflows:write",
  "feedbackRecords:write",
  "responses:write",
] as const;

export const grantDashboardsScopesToClients: MigrationScript = {
  type: "data",
  id: "v8k34tz7ey4mih96vnwxprc6",
  name: "20261022120001_grant_dashboards_scopes_to_clients",
  run: async ({ tx }) => {
    const migrationTx = tx as unknown as {
      $executeRaw: (query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<number>;
    };

    const readScopes = [...MCP_READ_SCOPES];
    const writeScopes = [...MCP_WRITE_SCOPES];

    const dashboardsReadAdded = await migrationTx.$executeRaw`
      UPDATE "oauthClient"
      SET "scopes" = "scopes" || ARRAY['dashboards:read']::TEXT[],
          "updatedAt" = NOW()
      WHERE "scopes" && ${readScopes}::TEXT[]
        AND NOT ('dashboards:read' = ANY("scopes"))
        AND "skipConsent" IS NOT TRUE
    `;

    const dashboardsWriteAdded = await migrationTx.$executeRaw`
      UPDATE "oauthClient"
      SET "scopes" = "scopes" || ARRAY['dashboards:write']::TEXT[],
          "updatedAt" = NOW()
      WHERE "scopes" && ${writeScopes}::TEXT[]
        AND NOT ('dashboards:write' = ANY("scopes"))
        AND "skipConsent" IS NOT TRUE
    `;

    // Migration progress, matching the sibling data migrations. `no-console` is not enabled for this
    // package (see its eslint.config.mjs), so no disable directive is needed.
    console.log(
      `ENG-6581 client dashboards scope grant: ${JSON.stringify({
        dashboardsReadAdded: Number(dashboardsReadAdded),
        dashboardsWriteAdded: Number(dashboardsWriteAdded),
      })}`
    );
  },
};
