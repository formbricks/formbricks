import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * ENG-7479 — grant `organization:read` to OAuth clients registered before that scope existed.
 *
 * The companion to 20261123130000, one table over, as 20261112130001 was for `audience:read`:
 * `/authorize` validates a request as a subset of the scopes a client REGISTERED with, and every
 * spec-following MCP client asks for what the protected-resource metadata advertises — which now includes
 * `organization:read`. Without this, every integration registered before today gets `invalid_scope` as its
 * connection re-authorizes. The scope is advertised in the same release as this migration.
 *
 * **Read only, to clients that read.** `organization` has no write scope, so `organization:read` goes to a
 * client holding any MCP `:read` resource scope and nothing goes to the rest.
 *
 * **Registration is a ceiling, not a grant.** A token still carries only what the user approves, and
 * existing grants keep Member attributes at No access. Net effect for an existing integration: one consent
 * screen naming the organization scope the next time it authorizes.
 *
 * **Except a `skipConsent` client, which is excluded:** the provider issues such a client a code before
 * any consent check, so widening its registration would hand out members' attributes with no prompt.
 *
 * One idempotent statement over a small table, run inside the runner's transaction. No-op on a fresh
 * database.
 */

/** Frozen as of this migration: the MCP read scopes before `organization:read` existed. */
const MCP_READ_SCOPES = [
  "surveys:read",
  "workflows:read",
  "feedbackRecords:read",
  "responses:read",
  "dashboards:read",
  "audience:read",
] as const;

export const grantOrganizationScopeToClients: MigrationScript = {
  type: "data",
  id: "qkioji1uyl7q3yot6yc8vj26",
  name: "20261123130001_grant_organization_scope_to_clients",
  run: async ({ tx }) => {
    const migrationTx = tx as unknown as {
      $executeRaw: (query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<number>;
    };

    const readScopes = [...MCP_READ_SCOPES];

    const organizationReadAdded = await migrationTx.$executeRaw`
      UPDATE "oauthClient"
      SET "scopes" = "scopes" || ARRAY['organization:read']::TEXT[],
          "updatedAt" = NOW()
      WHERE "scopes" && ${readScopes}::TEXT[]
        AND NOT ('organization:read' = ANY("scopes"))
        AND "skipConsent" IS NOT TRUE
    `;

    console.log(
      `ENG-7479 client organization scope grant: ${JSON.stringify({ organizationReadAdded: Number(organizationReadAdded) })}`
    );
  },
};
