import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * ENG-7149 — a grant for every MCP connection that exists before grants do (ADR-0041).
 *
 * From this release every MCP request reads the connection's grant and is refused without one, so every
 * existing OAuth consent needs one, or every connected client stops working on upgrade. Each gets exactly
 * the access its consent gives today:
 *
 *  - All access (organization & workspace access did not exist before);
 *  - every permission in a scope family the consent holds, at that family's level (`write` when the
 *    consent holds `<family>:write`, else `read`), capped at the highest level the permission offers, so
 *    Workflow runs and Feedback datasets stop at Read;
 *  - Tags and the Audience permissions at No access (absent), so an upgrade never hands an agent data it
 *    did not have before, though Tags shares the `responses` family.
 *  - for a Dashboard viewer (every membership the Dashboard viewer role, the rule of
 *    `isOnlyDashboardViewer`), only what the consent screen offers one: `dashboards:read`, so Charts and
 *    Dashboards at Read, whatever wider scopes a consent from before the role holds. A viewer's token is
 *    trimmed to `dashboards:read` on every MCP request anyway (ADR-0025), so this keeps the access the
 *    connection had, and Edit then offers no level the grant already exceeds.
 *
 * One grant per connection (user + client). The provider can hold duplicate consent rows for one
 * connection; the grant follows the most recently written row, and rows written in the same second
 * count only for the scopes every one of them holds, as `consentBound` in
 * `apps/web/modules/auth/lib/oauth-grant-revocation.ts` reads them.
 *
 * One statement inside the runner's transaction; memory stays in Postgres. Set-based throughout: each
 * step aggregates once over the whole table and the next joins its result, with no subquery that runs
 * once per connection, so the time grows with the number of consent rows, not with its square (50k
 * connections take seconds). Idempotent through `ON CONFLICT DO NOTHING` on the (user, client) key, so a
 * re-run, or a grant written by a new pod after the schema migration, is left alone. No-op on a fresh
 * database.
 *
 * Rolling upgrade: a consent an old pod writes after this runs has no grant. Its client is refused, and
 * its next refresh is refused and ends the connection, so the client goes back through the consent
 * screen, where a new pod writes the grant.
 */

/** Frozen as of this migration: each permission, the scope family that caps it, and its highest level. */
const CATALOGUE: readonly (readonly [permission: string, family: string, maxLevel: "read" | "write"])[] = [
  ["surveys", "surveys", "write"],
  ["creatives", "surveys", "write"],
  ["surveyStyling", "surveys", "write"],
  ["responses", "responses", "write"],
  ["workflows", "workflows", "write"],
  ["workflowRuns", "workflows", "read"],
  ["charts", "dashboards", "write"],
  ["dashboards", "dashboards", "write"],
  ["feedbackRecords", "feedbackRecords", "write"],
  ["feedbackDatasets", "feedbackRecords", "read"],
];

/** Frozen as of this migration: the only resource scope a Dashboard viewer can grant (ADR-0025). */
const DASHBOARD_VIEWER_SCOPE = "dashboards:read";

export const backfillMcpGrants: MigrationScript = {
  type: "data",
  id: "tniq2ibbij0x2rjgydhyu3dh",
  name: "20261112120001_backfill_mcp_grants",
  run: async ({ tx }) => {
    const migrationTx = tx as unknown as {
      $executeRaw: (query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<number>;
    };

    const permissions = CATALOGUE.map(([permission]) => permission);
    const families = CATALOGUE.map(([, family]) => family);
    const maxLevels = CATALOGUE.map(([, , maxLevel]) => maxLevel);

    const created = await migrationTx.$executeRaw`
      WITH catalogue AS (
        SELECT * FROM unnest(${permissions}::TEXT[], ${families}::TEXT[], ${maxLevels}::TEXT[])
          AS c("permission", "family", "maxLevel")
      ),
      ranked AS (
        SELECT "userId", "clientId", "scopes", "updatedAt",
          MAX("updatedAt") OVER (PARTITION BY "userId", "clientId") AS "at"
        FROM "oauthConsent"
        WHERE "userId" IS NOT NULL
      ),
      tied AS (
        SELECT "userId", "clientId", "scopes",
          COUNT(*) OVER (PARTITION BY "userId", "clientId") AS "rows"
        FROM ranked
        WHERE "updatedAt" = "at"
      ),
      viewers AS (
        SELECT "userId" FROM "Membership"
        GROUP BY "userId"
        HAVING bool_and("role" = 'dashboard_viewer')
      ),
      held AS (
        SELECT t."userId", t."clientId", s."scope"
        FROM tied t
        CROSS JOIN LATERAL (SELECT DISTINCT unnest(t."scopes") AS "scope") s
        LEFT JOIN viewers v ON v."userId" = t."userId"
        WHERE v."userId" IS NULL OR s."scope" = ${DASHBOARD_VIEWER_SCOPE}
        GROUP BY t."userId", t."clientId", t."rows", s."scope"
        HAVING COUNT(*) = t."rows"
      ),
      levels AS (
        SELECT h."userId", h."clientId", c."permission",
          CASE
            WHEN c."maxLevel" = 'write' AND bool_or(h."scope" = c."family" || ':write') THEN 'write'
            ELSE 'read'
          END AS "level"
        FROM held h
        JOIN catalogue c ON h."scope" IN (c."family" || ':read', c."family" || ':write')
        GROUP BY h."userId", h."clientId", c."permission", c."maxLevel"
      ),
      granted AS (
        SELECT "userId", "clientId", jsonb_object_agg("permission", "level") AS "permissions"
        FROM levels
        GROUP BY "userId", "clientId"
      ),
      connections AS (
        SELECT DISTINCT "userId", "clientId" FROM tied
      )
      INSERT INTO "McpGrant" ("id", "created_at", "updated_at", "userId", "clientId", "access", "permissions")
      SELECT gen_random_uuid()::TEXT, NOW(), NOW(), n."userId", n."clientId", 'all',
        COALESCE(g."permissions", '{}'::JSONB)
      FROM connections n
      LEFT JOIN granted g ON g."userId" = n."userId" AND g."clientId" = n."clientId"
      ON CONFLICT ("userId", "clientId") DO NOTHING
    `;

    // Migration progress, matching the sibling data migrations.
    console.log(`ENG-7149 MCP grant backfill: ${JSON.stringify({ grantsCreated: Number(created) })}`);
  },
};
