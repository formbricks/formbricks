import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * ENG-7151 — grant `audience:read` to OAuth clients registered before that scope existed.
 *
 * The companion to 20261112130000, one table over, as ENG-3470 (20261005130000) and ENG-6581
 * (20261022120001) were for their families: `/authorize` validates a request as a subset of the scopes a
 * client REGISTERED with, and every spec-following MCP client asks for what the protected-resource
 * metadata advertises — which now includes `audience:read`. Without this, every integration registered
 * before today gets `invalid_scope` as its connection re-authorizes. The scope is advertised in the same
 * release as this migration.
 *
 * **Read only, to clients that read.** `audience` has no write scope, so `audience:read` goes to a client
 * holding any MCP `:read` resource scope and nothing goes to the rest; a client holding only write scopes,
 * or no MCP resource scope, is not touched.
 *
 * **Registration is a ceiling, not a grant.** A token still carries only what the user approves, the
 * provider re-prompts whenever the stored consent does not cover the request, and existing grants keep
 * Audience at No access (ENG-7149's backfill). Net effect for an existing integration: one consent screen
 * naming the audience scope the next time it authorizes, after which the user may grant Audience.
 *
 * **Except a `skipConsent` client, which is excluded:** the provider issues such a client a code before
 * any consent check, so widening its registration would hand out contacts with no prompt.
 * `clientCredentialsScopes` is left alone; that grant refuses user-delegated scopes in any case.
 *
 * One idempotent statement over a small table (one row per registered integration), run inside the
 * runner's transaction. No-op on a fresh database.
 */

/** Frozen as of this migration: the MCP read scopes before `audience:read` existed. */
const MCP_READ_SCOPES = [
  "surveys:read",
  "workflows:read",
  "feedbackRecords:read",
  "responses:read",
  "dashboards:read",
] as const;

export const grantAudienceScopeToClients: MigrationScript = {
  type: "data",
  id: "nlr1g8tv2ce6mx5yrmxyvy6n",
  name: "20261112130001_grant_audience_scope_to_clients",
  run: async ({ tx }) => {
    const migrationTx = tx as unknown as {
      $executeRaw: (query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<number>;
    };

    const readScopes = [...MCP_READ_SCOPES];

    const audienceReadAdded = await migrationTx.$executeRaw`
      UPDATE "oauthClient"
      SET "scopes" = "scopes" || ARRAY['audience:read']::TEXT[],
          "updatedAt" = NOW()
      WHERE "scopes" && ${readScopes}::TEXT[]
        AND NOT ('audience:read' = ANY("scopes"))
        AND "skipConsent" IS NOT TRUE
    `;

    // Migration progress, matching the sibling data migrations. `no-console` is not enabled for this
    // package (see its eslint.config.mjs), so no disable directive is needed.
    console.log(
      `ENG-7151 client audience scope grant: ${JSON.stringify({ audienceReadAdded: Number(audienceReadAdded) })}`
    );
  },
};
