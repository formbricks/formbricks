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
 *
 * One grant per connection (user + client). The provider can hold duplicate consent rows for one
 * connection; the grant follows the most recently written row, and rows written in the same second
 * count only for the scopes every one of them holds, as `consentBound` in
 * `apps/web/modules/auth/lib/oauth-grant-revocation.ts` reads them.
 *
 * One statement, set-based, inside the runner's transaction; memory stays in Postgres. Idempotent through
 * `ON CONFLICT DO NOTHING` on the (user, client) key, so a re-run, or a grant written by a new pod after
 * the schema migration, is left alone. No-op on a fresh database.
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
      latest AS (
        SELECT "userId", "clientId", MAX("updatedAt") AS "at"
        FROM "oauthConsent"
        WHERE "userId" IS NOT NULL
        GROUP BY "userId", "clientId"
      ),
      tied AS (
        SELECT c."id", c."userId", c."clientId", c."scopes"
        FROM "oauthConsent" c
        JOIN latest l ON l."userId" = c."userId" AND l."clientId" = c."clientId" AND l."at" = c."updatedAt"
      ),
      held AS (
        SELECT t."userId", t."clientId", s."scope"
        FROM tied t
        CROSS JOIN LATERAL (SELECT DISTINCT unnest(t."scopes") AS "scope") s
        GROUP BY t."userId", t."clientId", s."scope"
        HAVING COUNT(*) = (
          SELECT COUNT(*) FROM tied t2 WHERE t2."userId" = t."userId" AND t2."clientId" = t."clientId"
        )
      ),
      connections AS (
        SELECT DISTINCT "userId", "clientId" FROM tied
      ),
      levels AS (
        SELECT n."userId", n."clientId", c."permission",
          CASE
            WHEN c."maxLevel" = 'write' AND EXISTS (
              SELECT 1 FROM held h
              WHERE h."userId" = n."userId" AND h."clientId" = n."clientId"
                AND h."scope" = c."family" || ':write'
            ) THEN 'write'
            WHEN EXISTS (
              SELECT 1 FROM held h
              WHERE h."userId" = n."userId" AND h."clientId" = n."clientId"
                AND h."scope" IN (c."family" || ':read', c."family" || ':write')
            ) THEN 'read'
          END AS "level"
        FROM connections n CROSS JOIN catalogue c
      )
      INSERT INTO "McpGrant" ("id", "created_at", "updated_at", "userId", "clientId", "access", "permissions")
      SELECT gen_random_uuid()::TEXT, NOW(), NOW(), n."userId", n."clientId", 'all',
        COALESCE(
          (SELECT jsonb_object_agg(l."permission", l."level") FROM levels l
           WHERE l."userId" = n."userId" AND l."clientId" = n."clientId" AND l."level" IS NOT NULL),
          '{}'::JSONB
        )
      FROM connections n
      ON CONFLICT ("userId", "clientId") DO NOTHING
    `;

    // Migration progress, matching the sibling data migrations.
    console.log(`ENG-7149 MCP grant backfill: ${JSON.stringify({ grantsCreated: Number(created) })}`);
  },
};
