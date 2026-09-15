import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * ENG-2862 — grant the new `responses:*` scopes on `oauthResource` rows that already exist.
 *
 * Adding a scope to `MCP_OAUTH_SCOPES` is not enough for an instance that has already upgraded, and
 * the failure is silent in both directions:
 *
 * - The ENG-2343 backfill (20260812110001) inserts the resource row with `ON CONFLICT DO NOTHING` and
 *   runs exactly once, so widening its literal `MCP_RESOURCE_ALLOWED_SCOPES` only reaches instances
 *   that have not run it yet.
 * - The plugin seeds `resourceSeedMode: "insertOnly"`, so it will not repair the row at boot either.
 *
 * And `resolveResourcePolicy` **intersects** the request against `allowedScopes` rather than
 * validating it, skipping only NULL/undefined. So a row stuck at the old list silently drops
 * `responses:read` / `responses:write` from every authorize request: a client that asks for only those
 * gets `invalid_scope`, and one that asks for them alongside `surveys:read` is quietly granted less
 * than it asked for. Nothing logs, and the operator sees a working MCP server with missing tools.
 *
 * Appends only what is missing, so it is idempotent and preserves the existing order. Scoped to MCP
 * resource identifiers — `resolveMcpResourceIdentifier` always produces `${WEBAPP_URL}/api/mcp` — so an
 * unrelated resource row, if one ever exists, is left alone. Matching on the identifier shape rather
 * than re-deriving it from `WEBAPP_URL` deliberately: an instance whose `WEBAPP_URL` has changed since
 * the 2343 backfill still has the old identifier in the row, and that row is exactly the one that needs
 * repairing.
 *
 * No-op on a fresh database, as the harness requires: with no `oauthResource` rows the plugin seeds the
 * full current list at first boot.
 */

const RESPONSE_SCOPES = ["responses:read", "responses:write"] as const;

export const eng2862GrantResponsesScopes: MigrationScript = {
  type: "data",
  id: "kz7m4qr9w2ft6bx1hs8dvn3c",
  name: "20260915120000_eng_2862_grant_responses_scopes",
  run: async ({ tx }) => {
    const migrationTx = tx as unknown as {
      $executeRaw: (query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<number>;
    };

    const scopes = [...RESPONSE_SCOPES];

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

    // Migration progress, matching the sibling data migrations. `no-console` is not enabled for this
    // package (see its eslint.config.mjs), so no disable directive is needed.
    console.log(`ENG-2862 responses scope grant: ${JSON.stringify({ resourcesUpdated: Number(updated) })}`);
  },
};
