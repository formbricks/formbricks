import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * ENG-7149 — a grant for every connection of a `skipConsent` client that exists before grants do
 * (ADR-0041), the companion to 20261112120001, which covered consents.
 *
 * A client registered with `skipConsent` (a trusted first-party client) is authorized without a consent
 * screen, so it has no consent row and 20261112120001 gave its connections no grant. Its code exchange
 * gives a new connection one; a refresh never does, because a refresh that rotated before a Revoke could
 * otherwise bring the grant back. So a refresh of a `skipConsent` connection without a grant is refused,
 * and every such connection made before grants needs one here, or each would have to authorize again.
 *
 * A connection is a (user, client) pair of a `skipConsent` client holding a live refresh token (not
 * revoked, not expired): one without is already over. Its grant follows the rule of 20261112120001 over
 * the scopes of its live refresh tokens:
 *
 *  - All access;
 *  - every permission in a scope family the tokens hold, at that family's level (`write` when they hold
 *    `<family>:write`, else `read`), capped at the highest level the permission offers;
 *  - Tags and the Audience permissions at No access (absent);
 *  - for a Dashboard viewer (every membership the Dashboard viewer role), `dashboards:read` only.
 *
 * Dated with the connection's earliest refresh token, so an access token issued before the upgrade is
 * issued under it (`/api/mcp` refuses one issued before its grant was created).
 *
 * One set-based statement inside the runner's transaction. Idempotent through `ON CONFLICT DO NOTHING` on
 * the (user, client) key, so a re-run, or a grant a new pod wrote first, is left alone. No-op on a fresh
 * database.
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

export const backfillSkipConsentMcpGrants: MigrationScript = {
  type: "data",
  id: "rjim5q55gmgmt364eoe5u43w",
  name: "20261112150000_backfill_skip_consent_mcp_grants",
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
      tokens AS (
        SELECT t."userId", t."clientId", t."scopes", t."createdAt", t."revoked", t."expiresAt"
        FROM "oauthRefreshToken" t
        JOIN "oauthClient" c ON c."clientId" = t."clientId"
        WHERE c."skipConsent" IS TRUE AND t."userId" IS NOT NULL
      ),
      connections AS (
        SELECT "userId", "clientId", MIN("createdAt") AS "connectedAt"
        FROM tokens
        GROUP BY "userId", "clientId"
        HAVING bool_or("revoked" IS NULL AND "expiresAt" > NOW())
      ),
      viewers AS (
        SELECT "userId" FROM "Membership"
        GROUP BY "userId"
        HAVING bool_and("role" = 'dashboard_viewer')
      ),
      held AS (
        SELECT DISTINCT t."userId", t."clientId", s."scope"
        FROM tokens t
        CROSS JOIN LATERAL unnest(t."scopes") AS s("scope")
        LEFT JOIN viewers v ON v."userId" = t."userId"
        WHERE t."revoked" IS NULL AND t."expiresAt" > NOW()
          AND (v."userId" IS NULL OR s."scope" = ${DASHBOARD_VIEWER_SCOPE})
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
      )
      INSERT INTO "McpGrant" ("id", "created_at", "updated_at", "userId", "clientId", "access", "permissions")
      SELECT gen_random_uuid()::TEXT, n."connectedAt", NOW(), n."userId", n."clientId", 'all',
        COALESCE(g."permissions", '{}'::JSONB)
      FROM connections n
      LEFT JOIN granted g ON g."userId" = n."userId" AND g."clientId" = n."clientId"
      ON CONFLICT ("userId", "clientId") DO NOTHING
    `;

    // Migration progress, matching the sibling data migrations.
    console.log(
      `ENG-7149 skipConsent MCP grant backfill: ${JSON.stringify({ grantsCreated: Number(created) })}`
    );
  },
};
