import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * ENG-6581 — grant the new `dashboards:*` scopes on `oauthResource` rows that already exist.
 *
 * The same repair ENG-2862 (20260915120000) made for `responses:*`, for the same reason: adding a scope
 * family to `MCP_SCOPE_FAMILIES` reaches only instances whose MCP resource row has not been seeded yet.
 * The ENG-2343 backfill runs once with `ON CONFLICT DO NOTHING`, and the plugin seeds with
 * `resourceSeedMode: "insertOnly"`, so an upgraded instance keeps its old `allowedScopes` — and
 * `resolveResourcePolicy` intersects every request against it, silently dropping `dashboards:read` /
 * `dashboards:write` from each authorize request. The operator sees a working MCP server whose chart and
 * dashboard tools are simply missing.
 *
 * Same SQL shape as ENG-2862, and for the reasons recorded there: appends only what is missing (idempotent,
 * order-preserving), matches MCP resource identifiers by shape rather than re-deriving them from
 * `WEBAPP_URL` (a changed URL leaves the old identifier in the row that needs repairing), one statement over
 * a table that holds one row per deployment, and a NULL `allowedScopes` is left alone because neither `@>`
 * nor `||` can repair it.
 *
 * No-op on a fresh database: with no `oauthResource` rows the plugin seeds the full current list at boot.
 */

const DASHBOARD_SCOPES = ["dashboards:read", "dashboards:write"] as const;

export const eng6581GrantDashboardsScopes: MigrationScript = {
  type: "data",
  id: "xkz4p520cpnnlf97mxzd9xbu",
  name: "20261022120000_eng_6581_grant_dashboards_scopes",
  run: async ({ tx }) => {
    const migrationTx = tx as unknown as {
      $executeRaw: (query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<number>;
    };

    const scopes = [...DASHBOARD_SCOPES];

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
    console.log(`ENG-6581 dashboards scope grant: ${JSON.stringify({ resourcesUpdated: Number(updated) })}`);
  },
};
