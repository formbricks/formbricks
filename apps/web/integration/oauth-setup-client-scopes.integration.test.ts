import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
// The data migration under test (auto-discovered by the migration runner at deploy).
import { grantAgentSetupScopesToClients } from "../../../packages/database/migration/20261029100100_grant_agent_setup_scopes_to_clients/migration";

/**
 * Agent-led setup scopes (ADR 0018) against real Postgres, the registered-client half. `/authorize`
 * checks a request against the scopes a client REGISTERED with, and the setup scopes are advertised in
 * `MCP_RESOURCE_SCOPES`, so a client registered before they existed would earn `invalid_scope`. The
 * migration mirrors what each client already holds: `account:read` for any MCP read scope, the three
 * writes for any MCP write scope. What it must not do matters as much: widen a read-only client to
 * write, touch a `skipConsent` client, or touch `clientCredentialsScopes`.
 *
 * The runner supplies `run` with its interactive transaction; here `prisma` stands in.
 */
const runGrant = () => grantAgentSetupScopesToClients.run!({ prisma, tx: prisma as never });

const SETUP_WRITES = ["workspaces:write", "organizations:write", "members:write"];

/** A client registered with every MCP scope as it stood before the setup scopes. */
const PRE_SETUP_SCOPES = [
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
];

let seq = 0;
const seedClient = async (
  scopes: string[],
  extra: { skipConsent?: boolean; clientCredentialsScopes?: string[] } = {}
): Promise<string> => {
  seq += 1;
  const clientId = `setup-scopes-client-${seq}`;
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

describe("agent setup scope grant to registered clients", () => {
  beforeEach(async () => {
    await resetDb();
  });

  test("a client holding the full pre-setup set gains all four scopes, appended", async () => {
    const clientId = await seedClient(PRE_SETUP_SCOPES);

    await runGrant();

    expect((await clientOf(clientId)).scopes).toEqual([...PRE_SETUP_SCOPES, "account:read", ...SETUP_WRITES]);
  });

  test("a client that registered read-only gains account:read and no write scope", async () => {
    const clientId = await seedClient(["surveys:read", "offline_access"]);

    await runGrant();

    const { scopes } = await clientOf(clientId);
    expect(scopes).toContain("account:read");
    for (const scope of SETUP_WRITES) expect(scopes).not.toContain(scope);
  });

  test("a client holding only a write scope gains the three setup writes and not account:read", async () => {
    const clientId = await seedClient(["contacts:write"]);

    await runGrant();

    expect((await clientOf(clientId)).scopes).toEqual(["contacts:write", ...SETUP_WRITES]);
  });

  test("a client holding only audit:read still counts as a reader", async () => {
    const clientId = await seedClient(["audit:read"]);

    await runGrant();

    expect((await clientOf(clientId)).scopes).toEqual(["audit:read", "account:read"]);
  });

  test("a client with no MCP resource scope is left alone", async () => {
    const clientId = await seedClient(["openid", "profile", "email"]);

    await runGrant();

    expect((await clientOf(clientId)).scopes).toEqual(["openid", "profile", "email"]);
  });

  test("a skipConsent client is left exactly as it was", async () => {
    // The provider hands a skipConsent client an authorization code before any consent check, so
    // widening its registration would grant organization administration with no prompt.
    const clientId = await seedClient(PRE_SETUP_SCOPES, { skipConsent: true });

    await runGrant();

    expect((await clientOf(clientId)).scopes).toEqual(PRE_SETUP_SCOPES);
  });

  test("a client whose skipConsent is explicitly false is repaired like any other", async () => {
    const clientId = await seedClient(["surveys:read"], { skipConsent: false });

    await runGrant();

    expect((await clientOf(clientId)).scopes).toContain("account:read");
  });

  test("clientCredentialsScopes is never touched", async () => {
    const clientId = await seedClient(PRE_SETUP_SCOPES, { clientCredentialsScopes: ["surveys:read"] });

    await runGrant();

    expect((await clientOf(clientId)).clientCredentialsScopes).toEqual(["surveys:read"]);
  });

  test("a client that already holds some of the scopes gets only what is missing, once, on every run", async () => {
    const partial = await seedClient([...PRE_SETUP_SCOPES, "account:read", "members:write"]);

    await runGrant();
    const afterFirst = await clientOf(partial);
    await runGrant();

    for (const scope of ["account:read", ...SETUP_WRITES]) {
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
