import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
// The data migration under test (auto-discovered by the migration runner at deploy).
import { eng3470GrantResponsesScopesToClients } from "../../../packages/database/migration/20261005130000_eng_3470_grant_responses_scopes_to_clients/migration";

/**
 * ENG-3470 against real Postgres. Advertising `responses:*` makes spec-following MCP clients ask for
 * them, and `/authorize` checks the request against the scopes a client REGISTERED with — so a client
 * registered before those scopes existed would get `invalid_scope`. This migration widens those
 * registrations. What it must NOT do matters as much as what it does: it must not hand write access to
 * a client that registered itself read-only, must not touch a `skipConsent` client (the provider skips
 * the consent prompt for one, so widening it would grant respondent data silently), and must not touch
 * `clientCredentialsScopes`.
 *
 * The runner supplies `run` with its interactive transaction; here `prisma` stands in, the same shape
 * the ENG-2862 suite uses.
 */
const runGrant = () => eng3470GrantResponsesScopesToClients.run!({ prisma, tx: prisma as never });

/** A client registered with the full default set as it stood before ENG-2862. */
const PRE_ENG2862_SCOPES = [
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
];

let seq = 0;
const seedClient = async (
  scopes: string[],
  extra: { skipConsent?: boolean; clientCredentialsScopes?: string[] } = {}
): Promise<string> => {
  seq += 1;
  const clientId = `eng3470-client-${seq}`;
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

describe("ENG-3470 responses scope grant to registered clients", () => {
  beforeEach(async () => {
    await resetDb();
  });

  test("a client registered with the pre-ENG-2862 defaults gains both scopes, appended", async () => {
    const clientId = await seedClient(PRE_ENG2862_SCOPES);

    await runGrant();

    // Appended, not reordered: everything the client was registered for is still there, in order.
    expect((await clientOf(clientId)).scopes).toEqual([
      ...PRE_ENG2862_SCOPES,
      "responses:read",
      "responses:write",
    ]);
  });

  test("a client that registered read-only gains read only", async () => {
    // Better Auth 1.6 registered exactly the scopes a client asked for, so a read-only registration
    // was a boundary the integration chose. Widening it to write would override that choice.
    const clientId = await seedClient(["surveys:read", "offline_access"]);

    await runGrant();

    const { scopes } = await clientOf(clientId);
    expect(scopes).toContain("responses:read");
    expect(scopes).not.toContain("responses:write");
  });

  test("a client holding only write scopes gains write only", async () => {
    const clientId = await seedClient(["workflows:write"]);

    await runGrant();

    expect((await clientOf(clientId)).scopes).toEqual(["workflows:write", "responses:write"]);
  });

  test("any single MCP read scope is enough to qualify", async () => {
    const clientId = await seedClient(["feedbackRecords:read"]);

    await runGrant();

    expect((await clientOf(clientId)).scopes).toEqual(["feedbackRecords:read", "responses:read"]);
  });

  test("a client with no MCP resource scope is left alone", async () => {
    const clientId = await seedClient(["openid", "profile", "email"]);

    await runGrant();

    expect((await clientOf(clientId)).scopes).toEqual(["openid", "profile", "email"]);
  });

  test("a skipConsent client is left exactly as it was", async () => {
    // The provider hands a skipConsent client an authorization code before any consent check, so
    // widening its registration would grant respondent data with no prompt. This is the case the
    // `skipConsent IS NOT TRUE` clause exists for — drop the clause and this goes red.
    const clientId = await seedClient(PRE_ENG2862_SCOPES, { skipConsent: true });

    await runGrant();

    expect((await clientOf(clientId)).scopes).toEqual(PRE_ENG2862_SCOPES);
  });

  test("a client whose skipConsent is explicitly false is repaired like any other", async () => {
    const clientId = await seedClient(["surveys:read"], { skipConsent: false });

    await runGrant();

    expect((await clientOf(clientId)).scopes).toContain("responses:read");
  });

  test("clientCredentialsScopes is never touched", async () => {
    const clientId = await seedClient(PRE_ENG2862_SCOPES, { clientCredentialsScopes: ["surveys:read"] });

    await runGrant();

    expect((await clientOf(clientId)).clientCredentialsScopes).toEqual(["surveys:read"]);
  });

  test("a client that already holds the scopes is unchanged, and a second run changes nothing", async () => {
    const already = await seedClient([...PRE_ENG2862_SCOPES, "responses:read", "responses:write"]);
    const partial = await seedClient([...PRE_ENG2862_SCOPES, "responses:read"]);

    await runGrant();
    const afterFirst = await Promise.all([clientOf(already), clientOf(partial)]);
    await runGrant();

    expect((await clientOf(already)).scopes).toEqual([
      ...PRE_ENG2862_SCOPES,
      "responses:read",
      "responses:write",
    ]);
    // Only what was missing is added, once.
    expect(afterFirst[1].scopes.filter((scope) => scope === "responses:read")).toHaveLength(1);
    expect(afterFirst[1].scopes).toContain("responses:write");
    expect(await Promise.all([clientOf(already), clientOf(partial)])).toEqual(afterFirst);
  });

  // No NULL-`scopes` case, unlike the ENG-2862 suite: `oauthClient.scopes` is NOT NULL (default `{}`),
  // so the half-repair that suite guards against has no row to happen to.

  test("is a no-op on a fresh database, as the migration harness requires", async () => {
    await expect(runGrant()).resolves.not.toThrow();
    expect(await prisma.oauthClient.count()).toBe(0);
  });
});
