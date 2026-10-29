import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
// The data migration under test (auto-discovered by the migration runner at deploy).
import { grantMembersTeamsScopesToClients } from "../../../packages/database/migration/20261029110100_grant_members_teams_scopes_to_clients/migration";

/**
 * Members and teams scopes (ADR 0018, round 3) against real Postgres, the registered-client half. `/authorize`
 * checks a request against the scopes a client REGISTERED with, and the new scopes are advertised in
 * `MCP_RESOURCE_SCOPES`, so a client registered before they existed would earn `invalid_scope`. The migration
 * mirrors what each client already holds: `members:read` and `teams:read` for any MCP read scope, `teams:write`
 * for any MCP write scope (`members:write` went out with the first setup migration). What it must not do
 * matters as much: widen a read-only client to write, touch a `skipConsent` client, or touch
 * `clientCredentialsScopes`.
 *
 * The runner supplies `run` with its interactive transaction; here `prisma` stands in.
 */
const runGrant = () => grantMembersTeamsScopesToClients.run!({ prisma, tx: prisma as never });

const READS = ["members:read", "teams:read"];

/** A client registered with every MCP scope as it stood before round 3. */
const PRE_ROUND_3_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "surveys:read",
  "surveys:write",
  "workflows:read",
  "workflows:write",
  "feedbackRecords:read",
  "feedbackRecords:write",
  "responses:read",
  "responses:write",
  "contacts:read",
  "contacts:write",
  "webhooks:read",
  "webhooks:write",
  "audit:read",
  "account:read",
  "workspaces:write",
  "organizations:write",
  "members:write",
];

let seq = 0;
const seedClient = async (
  scopes: string[],
  extra: { skipConsent?: boolean; clientCredentialsScopes?: string[] } = {}
): Promise<string> => {
  seq += 1;
  const clientId = `members-teams-scopes-client-${seq}`;
  await prisma.oauthClient.create({
    data: { clientId, redirectUris: ["http://127.0.0.1:33418/callback"], scopes, ...extra },
  });
  return clientId;
};

const clientOf = (clientId: string) =>
  prisma.oauthClient.findUniqueOrThrow({
    where: { clientId },
    select: { scopes: true, clientCredentialsScopes: true, skipConsent: true },
  });

describe("members and teams scope grant to registered clients", () => {
  beforeEach(async () => {
    await resetDb();
  });

  test("a client holding the full pre-round-3 set gains all three scopes, appended", async () => {
    const clientId = await seedClient(PRE_ROUND_3_SCOPES);

    await runGrant();

    expect((await clientOf(clientId)).scopes).toEqual([...PRE_ROUND_3_SCOPES, ...READS, "teams:write"]);
  });

  test("a client that registered read-only gains the two reads and no write scope", async () => {
    const clientId = await seedClient(["surveys:read", "offline_access"]);

    await runGrant();

    const { scopes } = await clientOf(clientId);
    expect(scopes).toEqual(["surveys:read", "offline_access", ...READS]);
    expect(scopes).not.toContain("teams:write");
  });

  test("a client holding only a write scope gains teams:write and not the reads", async () => {
    const clientId = await seedClient(["contacts:write"]);

    await runGrant();

    expect((await clientOf(clientId)).scopes).toEqual(["contacts:write", "teams:write"]);
  });

  test("a client holding only a setup scope counts as a reader or writer by that scope's level", async () => {
    const reader = await seedClient(["account:read"]);
    const writer = await seedClient(["members:write"]);

    await runGrant();

    expect((await clientOf(reader)).scopes).toEqual(["account:read", ...READS]);
    expect((await clientOf(writer)).scopes).toEqual(["members:write", "teams:write"]);
  });

  test("a client with no MCP resource scope is left alone", async () => {
    const clientId = await seedClient(["openid", "profile", "email"]);

    await runGrant();

    expect((await clientOf(clientId)).scopes).toEqual(["openid", "profile", "email"]);
  });

  test("a skipConsent client is left exactly as it was", async () => {
    // The provider hands a skipConsent client an authorization code before any consent check, so
    // widening its registration would grant member and team administration with no prompt.
    const clientId = await seedClient(PRE_ROUND_3_SCOPES, { skipConsent: true });

    await runGrant();

    expect((await clientOf(clientId)).scopes).toEqual(PRE_ROUND_3_SCOPES);
  });

  test("a client whose skipConsent is explicitly false is repaired like any other", async () => {
    const clientId = await seedClient(["surveys:read"], { skipConsent: false });

    await runGrant();

    expect((await clientOf(clientId)).scopes).toContain("members:read");
  });

  test("clientCredentialsScopes is never touched", async () => {
    const clientId = await seedClient(PRE_ROUND_3_SCOPES, { clientCredentialsScopes: ["surveys:read"] });

    await runGrant();

    expect((await clientOf(clientId)).clientCredentialsScopes).toEqual(["surveys:read"]);
  });

  test("a client that already holds some of the scopes gets only what is missing, once, on every run", async () => {
    const partial = await seedClient([...PRE_ROUND_3_SCOPES, "teams:read"]);

    await runGrant();
    const afterFirst = await clientOf(partial);
    await runGrant();

    for (const scope of [...READS, "teams:write"]) {
      expect(
        afterFirst.scopes.filter((entry) => entry === scope),
        scope
      ).toHaveLength(1);
    }
    expect(await clientOf(partial)).toEqual(afterFirst);
  });

  test("is a no-op on a fresh database, as the migration harness requires", async () => {
    await expect(runGrant()).resolves.not.toThrow();
    expect(await prisma.oauthClient.count()).toBe(0);
  });
});
