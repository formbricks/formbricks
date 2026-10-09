import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * ENG-3470 — grant `responses:*` to OAuth clients that registered before those scopes existed.
 *
 * The companion to ENG-2862 (20260915120000), one table over. That migration repaired the resource
 * row's `allowedScopes`; this one repairs each client's registered `scopes`, which is the other list
 * `/authorize` checks. The provider validates a requested scope as a subset of the scopes the client
 * REGISTERED with, and a client registered before mid-September was registered without `responses:*`.
 * Advertising them (ENG-3470 adds them to `MCP_RESOURCE_SCOPES`) makes every spec-following client —
 * the MCP SDK client takes its scope from the 401 challenge and the protected-resource metadata — ask
 * for them, and such a client would get `invalid_scope` until someone reconnected the integration.
 *
 * **Mirrors what the client already holds rather than granting both.** `responses:read` goes to a
 * client holding any MCP `:read` resource scope, `responses:write` to one holding any MCP `:write`
 * scope. A client that registered itself read-only under Better Auth 1.6, which registered exactly the
 * scopes asked for, stays read-only. Clients holding no MCP resource scope are not touched at all.
 *
 * **Registration is a ceiling, not a grant.** Widening it hands nothing over by itself: a token still
 * carries only what the user approves, and the provider re-prompts whenever the stored consent does not
 * cover the request. A refresh cannot reach the wider ceiling either, because it is bounded by the
 * original grant's scopes, not the registration. Net effect for an existing integration: its user sees
 * one consent screen naming the response scopes the next time it authorizes. This brings pre-ENG-2862
 * clients level with what Better Auth 1.7 already registers new clients with, since 1.7 applies
 * `clientRegistrationDefaultScopes` regardless of what a client asks for.
 *
 * **Except a `skipConsent` client, which is why those are excluded.** The provider hands such a client
 * an authorization code before any consent check, so widening its registration WOULD grant respondent
 * data without the user seeing a prompt. Only the provider's admin client endpoints can set the flag —
 * dynamic registration cannot, and Formbricks never calls those endpoints — so this likely matches no
 * row. It is excluded anyway, so the property holds by construction rather than by that observation.
 *
 * `clientCredentialsScopes` is deliberately left alone. It is the only list that bounds the
 * `client_credentials` grant, and that grant refuses user-delegated scopes such as these in any case.
 *
 * **One statement per scope rather than batched**, for the same reason as ENG-2862: the table is small
 * — one row per registered integration — so a resumable cursor would be machinery with nothing to do.
 * Each append is idempotent (`NOT (scope = ANY(scopes))` makes a re-run a no-op), preserves order, and
 * runs inside the runner's transaction, so a failure leaves nothing half-applied.
 *
 * The counts logged at the end are the only record of the widening: nothing writes a per-client entry.
 *
 * No-op on a fresh database, where there are no client rows yet.
 */

/** Frozen as of this migration: the MCP resource scopes before the response pair existed. */
const MCP_READ_SCOPES = ["surveys:read", "workflows:read", "feedbackRecords:read"] as const;
const MCP_WRITE_SCOPES = ["surveys:write", "workflows:write", "feedbackRecords:write"] as const;

export const eng3470GrantResponsesScopesToClients: MigrationScript = {
  type: "data",
  id: "i1aq86m5aezzheqnztvohsf5",
  name: "20261005130000_eng_3470_grant_responses_scopes_to_clients",
  run: async ({ tx }) => {
    const migrationTx = tx as unknown as {
      $executeRaw: (query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<number>;
    };

    const readScopes = [...MCP_READ_SCOPES];
    const writeScopes = [...MCP_WRITE_SCOPES];

    const responsesReadAdded = await migrationTx.$executeRaw`
      UPDATE "oauthClient"
      SET "scopes" = "scopes" || ARRAY['responses:read']::TEXT[],
          "updatedAt" = NOW()
      WHERE "scopes" && ${readScopes}::TEXT[]
        AND NOT ('responses:read' = ANY("scopes"))
        AND "skipConsent" IS NOT TRUE
    `;

    const responsesWriteAdded = await migrationTx.$executeRaw`
      UPDATE "oauthClient"
      SET "scopes" = "scopes" || ARRAY['responses:write']::TEXT[],
          "updatedAt" = NOW()
      WHERE "scopes" && ${writeScopes}::TEXT[]
        AND NOT ('responses:write' = ANY("scopes"))
        AND "skipConsent" IS NOT TRUE
    `;

    // Migration progress, matching the sibling data migrations. `no-console` is not enabled for this
    // package (see its eslint.config.mjs), so no disable directive is needed.
    console.log(
      `ENG-3470 client responses scope grant: ${JSON.stringify({
        responsesReadAdded: Number(responsesReadAdded),
        responsesWriteAdded: Number(responsesWriteAdded),
      })}`
    );
  },
};
