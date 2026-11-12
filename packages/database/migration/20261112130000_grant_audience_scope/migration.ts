import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * ENG-7151 — grant the new `audience:read` scope on `oauthResource` rows that already exist.
 *
 * The same repair ENG-2862 (20260915120000) and ENG-6581 (20261022120000) made for their families, for the
 * same reason: a new family in `oauth-urls.ts` reaches only instances whose MCP resource row has not been
 * seeded yet. The plugin seeds with `resourceSeedMode: "insertOnly"`, so an upgraded instance keeps its old
 * `allowedScopes`, and `resolveResourcePolicy` intersects every authorize request against it — a client
 * asking for `audience:read` would be silently granted less, and one asking only for it would get
 * `invalid_scope`.
 *
 * `audience` is read-only: contacts, contact attributes, segments and action classes have only read tools,
 * so there is no `audience:write` to grant.
 *
 * Same SQL shape as its predecessors: appends only what is missing (idempotent, order-preserving), matches
 * MCP resource identifiers by shape rather than re-deriving them from `WEBAPP_URL`, one statement over a
 * table that holds one row per deployment, and a NULL `allowedScopes` is left alone.
 *
 * No-op on a fresh database: with no `oauthResource` rows the plugin seeds the full current list at boot.
 */

const AUDIENCE_SCOPES = ["audience:read"] as const;

export const grantAudienceScope: MigrationScript = {
  type: "data",
  id: "hjoswacc3j4psjrkkg84p26x",
  name: "20261112130000_grant_audience_scope",
  run: async ({ tx }) => {
    const migrationTx = tx as unknown as {
      $executeRaw: (query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<number>;
    };

    const scopes = [...AUDIENCE_SCOPES];

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
    console.log(`ENG-7151 audience scope grant: ${JSON.stringify({ resourcesUpdated: Number(updated) })}`);
  },
};
