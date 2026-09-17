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
 *
 * **Deliberately one statement rather than batched.** The convention for data migrations is that a
 * long-running `UPDATE` over a whole table is chunked and resumable, and this is neither: `oauthResource`
 * holds one row per deployment — `resolveMcpResourceIdentifier` yields exactly one identifier, and the
 * plugin seeds exactly that — so the `WHERE` matches one row on a real instance and a handful on a dev
 * database that has changed `WEBAPP_URL`. Batching machinery would add a resumable cursor over a table
 * that does not need one. The properties the convention is actually protecting are met directly: the
 * append is idempotent (`NOT (allowedScopes @> …)` makes a re-run a no-op), convergent, and atomic, so
 * a partial failure leaves nothing to resume.
 *
 * **A NULL `allowedScopes` is left alone, but not because NULL is permissive.** An earlier version of
 * this comment claimed it was — that `resolveResourcePolicy` skips NULL/undefined, so NULL means "allow
 * everything". That is wrong at this layer, and the mistake is worth recording. The column is nullable
 * (`TEXT[] DEFAULT ARRAY[]::TEXT[]`, no NOT NULL), but the policy resolver never sees a NULL: Prisma
 * types the field `String[]`, and reading a row whose column is genuinely NULL yields `[]`, not `null`
 * — measured against this schema on a live database, not inferred. So a NULL row already behaves as an
 * **empty** allow-list, which per ENG-2343 intersects every request down to zero scopes.
 *
 * The SQL is still right to skip it, for a plainer reason: `@>` against NULL yields NULL, so the `WHERE`
 * never matches, and `NULL || ARRAY[…]` is NULL, so appending could not repair the row even if it did.
 * Coalescing to `'{}'` does not help either — the append's subquery compares against the original NULL
 * column and `= ANY(NULL)` is NULL, so nothing is appended and the row lands at an empty list.
 *
 * Such a row is therefore broken for every scope, not just the new ones, and repairing it is a different
 * fix from this one. It is also not reachable through the product: the DDL defaults to `[]` and Prisma's
 * `String[]` never writes NULL, so only hand-written SQL can produce one. Parked rather than widened
 * into here. The test below pins that this migration leaves such a row untouched — which is all it
 * proves, and all it should.
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
