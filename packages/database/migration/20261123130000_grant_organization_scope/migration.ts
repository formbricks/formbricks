import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * ENG-7479 — grant the new `organization:read` scope on `oauthResource` rows that already exist.
 *
 * The same repair ENG-7151 (20261112130000) made for `audience:read`: a new family in `oauth-urls.ts`
 * reaches only instances whose MCP resource row has not been seeded yet. The plugin seeds with
 * `resourceSeedMode: "insertOnly"`, so an upgraded instance keeps its old `allowedScopes`, and
 * `resolveResourcePolicy` intersects every authorize request against it — a client asking for
 * `organization:read` would be silently granted less, and one asking only for it would get
 * `invalid_scope`.
 *
 * `organization` is read-only: the organization settings an agent may read (Member attributes, ENG-7479)
 * have only read tools, so there is no `organization:write` to grant.
 *
 * Same SQL shape as its predecessors: appends only what is missing (idempotent, order-preserving), matches
 * MCP resource identifiers by shape rather than re-deriving them from `WEBAPP_URL`, one statement over a
 * table that holds one row per deployment, and a NULL `allowedScopes` is left alone.
 *
 * No-op on a fresh database: with no `oauthResource` rows the plugin seeds the full current list at boot.
 */

const ORGANIZATION_SCOPES = ["organization:read"] as const;

export const grantOrganizationScope: MigrationScript = {
  type: "data",
  id: "kuxrng5b82w91wssq3n4l0fg",
  name: "20261123130000_grant_organization_scope",
  run: async ({ tx }) => {
    const migrationTx = tx as unknown as {
      $executeRaw: (query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<number>;
    };

    const scopes = [...ORGANIZATION_SCOPES];

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
    console.log(
      `ENG-7479 organization scope grant: ${JSON.stringify({ resourcesUpdated: Number(updated) })}`
    );
  },
};
