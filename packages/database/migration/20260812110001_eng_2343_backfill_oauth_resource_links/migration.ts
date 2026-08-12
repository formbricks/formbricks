import { createId } from "@paralleldrive/cuid2";
import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * ENG-2343 — the half of the Better Auth 1.7 resource migration that SQL cannot do.
 *
 * The sibling schema migration (20260812110000) adds every table, column and index, and backfills
 * `Account.issuer`, because that value derives from `Account.provider` alone. Everything here needs
 * the deployment's own MCP resource identifier — `${WEBAPP_URL}/api/mcp` — which is environment
 * specific and differs for every self-hoster, so it has to be read from the environment at migration
 * time rather than hardcoded in SQL.
 *
 * What breaks without it, on an instance that already has MCP clients:
 * - `oauthClientResource`: with `enforcePerClientResources` (the 1.7 default) a client with no link
 *   row fails `invalid_target` at the token endpoint — *after* the user has consented. Every already
 *   registered MCP client would break, and we cannot ask end users' MCP clients to re-register.
 * - `oauthRefreshToken.resources`: a refresh with no recorded resources mints a token with no
 *   audience, i.e. an opaque one the MCP resource server rejects.
 * - `oauthConsent.resources`: `/authorize` compares requested resources against the consented set, so
 *   an empty set forces every live connection back through the consent screen.
 *
 * The `oauthResource` row itself is normally seeded by the plugin at boot from its `resources`
 * option. We insert it here as well because `oauthClientResource.resourceId` is a foreign key to
 * `oauthResource.identifier`, so the link rows cannot exist until it does, and migrations run before
 * the app boots. Seeding is `insertOnly` upstream, so the plugin will not fight this row.
 *
 * No-op on an empty database, as the harness requires: with no `oauthClient` rows there is nothing to
 * link, and the resource row is only inserted when there is at least one client that needs it — a
 * fresh install gets it from the plugin at first boot instead.
 */

interface TMigrationTx {
  $executeRaw: (query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<unknown>;
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<T>;
}

export interface TOauthResourceBackfillStats {
  clients: number;
  linked: number;
  refreshTokens: number;
  consents: number;
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

/**
 * Mirrors `getMcpResourceUrl()` in apps/web/modules/auth/lib/oauth-urls.ts. Kept as a local copy on
 * purpose: `packages/database` must not import from `apps/web`, and a migration has to keep producing
 * the value that was correct when it ran even if the app-side helper later changes.
 */
export const resolveMcpResourceIdentifier = (webAppUrl: string | undefined): string | null => {
  const configured = webAppUrl?.trim();
  if (!configured) return null;

  try {
    const url = new URL(configured);
    url.hash = "";
    url.search = "";
    const basePath = trimTrailingSlash(url.pathname);
    return `${url.origin}${basePath.endsWith("/api/mcp") ? basePath : `${basePath}/api/mcp`}`;
  } catch {
    return null;
  }
};

export const eng2343BackfillOauthResourceLinks: MigrationScript = {
  type: "data",
  id: "hqp3s7v1c0m9x4k2t8g6nd5j",
  name: "20260812110001_eng_2343_backfill_oauth_resource_links",
  run: async ({ tx }) => {
    const migrationTx = tx as unknown as TMigrationTx;

    const [{ count: clientCount }] = await migrationTx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "oauthClient"
    `;
    const clients = Number(clientCount);

    // Fresh database: the plugin seeds the resource at boot and there is nothing to link.
    if (clients === 0) {
      return;
    }

    const resourceIdentifier = resolveMcpResourceIdentifier(process.env.WEBAPP_URL);
    if (!resourceIdentifier) {
      // Deliberately loud. Existing MCP clients will fail `invalid_target` until this is backfilled,
      // and continuing quietly would hide that until a user hits it.
      throw new Error(
        "ENG-2343: WEBAPP_URL is not set or is not a valid URL, so the MCP resource identifier cannot " +
          "be derived. Existing OAuth clients cannot be linked to their resource. Set WEBAPP_URL and " +
          "re-run the migration."
      );
    }

    // Matches what the plugin would seed from its `resources` option, so `insertOnly` seeding at boot
    // is a no-op afterwards. `name` is descriptive only.
    await migrationTx.$executeRaw`
      INSERT INTO "oauthResource" ("id", "identifier", "name", "createdAt", "updatedAt")
      VALUES (${createId()}, ${resourceIdentifier}, 'Formbricks MCP', NOW(), NOW())
      ON CONFLICT ("identifier") DO NOTHING
    `;

    // One statement per client rather than an INSERT..SELECT: ids must be cuid2 to match the rest of
    // the schema (`advanced.database.generateId` forces cuid2 app-wide), and a set-based insert would
    // have to fall back to a database-side uuid. The row count here is the number of registered OAuth
    // clients, so the loop is not a concern.
    const clientRows = await migrationTx.$queryRaw<{ clientId: string }[]>`
      SELECT "clientId" FROM "oauthClient"
    `;

    let linked = 0;
    for (const { clientId } of clientRows) {
      linked += Number(
        await migrationTx.$executeRaw`
          INSERT INTO "oauthClientResource" ("id", "clientId", "resourceId", "createdAt")
          VALUES (${createId()}, ${clientId}, ${resourceIdentifier}, NOW())
          ON CONFLICT ("clientId", "resourceId") DO NOTHING
        `
      );
    }

    const refreshTokens = await migrationTx.$executeRaw`
      UPDATE "oauthRefreshToken"
      SET "resources" = ARRAY[${resourceIdentifier}]::TEXT[]
      WHERE "resources" IS NULL OR cardinality("resources") = 0
    `;

    const consents = await migrationTx.$executeRaw`
      UPDATE "oauthConsent"
      SET "resources" = ARRAY[${resourceIdentifier}]::TEXT[]
      WHERE "resources" IS NULL OR cardinality("resources") = 0
    `;

    const stats: TOauthResourceBackfillStats = {
      clients,
      linked,
      refreshTokens: Number(refreshTokens),
      consents: Number(consents),
    };

    // eslint-disable-next-line no-console -- migration progress, matches the sibling data migrations
    console.log(`ENG-2343 oauth resource backfill: ${JSON.stringify(stats)}`);
  },
};
