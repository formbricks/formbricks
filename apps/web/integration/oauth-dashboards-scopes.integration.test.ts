import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { MCP_OAUTH_SCOPES } from "@/modules/auth/lib/oauth-urls";
// The data migrations under test (auto-discovered by the migration runner at deploy).
import { eng6581GrantDashboardsScopes } from "../../../packages/database/migration/20261022120000_eng_6581_grant_dashboards_scopes/migration";
import { eng6581GrantDashboardsScopesToClients } from "../../../packages/database/migration/20261022120001_eng_6581_grant_dashboards_scopes_to_clients/migration";

/**
 * ENG-6581 against real Postgres: the two repairs that let upgraded instances grant `dashboards:*`.
 * Both failures they prevent are silent — a resource row that intersects the scopes away, or a client
 * registration that makes `/authorize` answer `invalid_scope` — so only a real `UPDATE` can show them.
 *
 * The runner supplies `run` with its interactive transaction; here `prisma` stands in, the same shape the
 * ENG-2862 and ENG-3470 suites use.
 */
const runResourceGrant = () => eng6581GrantDashboardsScopes.run!({ prisma, tx: prisma as never });
const runClientGrant = () => eng6581GrantDashboardsScopesToClients.run!({ prisma, tx: prisma as never });

/** What an upgraded instance holds after ENG-2862 and ENG-3470, before this change. */
const PRE_ENG6581_SCOPES = [
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
];

const MCP_IDENTIFIER = "https://app.example.com/api/mcp";

const seedResource = (identifier: string, allowedScopes: string[]) =>
  prisma.oauthResource.create({ data: { identifier, name: "Formbricks MCP", allowedScopes } });

const resourceScopesOf = async (identifier: string): Promise<string[]> =>
  (await prisma.oauthResource.findUniqueOrThrow({ where: { identifier }, select: { allowedScopes: true } }))
    .allowedScopes;

let seq = 0;
const seedClient = async (scopes: string[], extra: { skipConsent?: boolean } = {}): Promise<string> => {
  seq += 1;
  const clientId = `eng6581-client-${seq}`;
  await prisma.oauthClient.create({
    data: { clientId, redirectUris: ["http://127.0.0.1:33418/callback"], scopes, ...extra },
  });
  return clientId;
};

const clientScopesOf = async (clientId: string): Promise<string[]> =>
  (await prisma.oauthClient.findUniqueOrThrow({ where: { clientId }, select: { scopes: true } })).scopes;

describe("ENG-6581 dashboards scope grant on the MCP resource", () => {
  beforeEach(async () => {
    await resetDb();
  });

  test("appends both scopes to an upgraded row, keeping its order", async () => {
    await seedResource(MCP_IDENTIFIER, PRE_ENG6581_SCOPES);

    await runResourceGrant();

    expect(await resourceScopesOf(MCP_IDENTIFIER)).toEqual([
      ...PRE_ENG6581_SCOPES,
      "dashboards:read",
      "dashboards:write",
    ]);
  });

  test("leaves the row able to grant every scope the app advertises", async () => {
    await seedResource(MCP_IDENTIFIER, PRE_ENG6581_SCOPES);

    await runResourceGrant();

    const allowed = new Set(await resourceScopesOf(MCP_IDENTIFIER));
    expect(MCP_OAUTH_SCOPES.filter((scope) => !allowed.has(scope))).toEqual([]);
  });

  test("is idempotent — a second run changes nothing", async () => {
    await seedResource(MCP_IDENTIFIER, PRE_ENG6581_SCOPES);

    await runResourceGrant();
    const afterFirst = await resourceScopesOf(MCP_IDENTIFIER);
    await runResourceGrant();

    expect(await resourceScopesOf(MCP_IDENTIFIER)).toEqual(afterFirst);
  });

  test("adds only what is missing after a partial apply", async () => {
    await seedResource(MCP_IDENTIFIER, [...PRE_ENG6581_SCOPES, "dashboards:read"]);

    await runResourceGrant();

    expect(await resourceScopesOf(MCP_IDENTIFIER)).toEqual([
      ...PRE_ENG6581_SCOPES,
      "dashboards:read",
      "dashboards:write",
    ]);
  });

  test("leaves a non-MCP resource alone", async () => {
    const other = "https://app.example.com/api/something-else";
    await seedResource(MCP_IDENTIFIER, PRE_ENG6581_SCOPES);
    await seedResource(other, ["surveys:read"]);

    await runResourceGrant();

    expect(await resourceScopesOf(other)).toEqual(["surveys:read"]);
    expect(await resourceScopesOf(MCP_IDENTIFIER)).toContain("dashboards:write");
  });

  test("is a no-op on a fresh database", async () => {
    await expect(runResourceGrant()).resolves.not.toThrow();
    expect(await prisma.oauthResource.count()).toBe(0);
  });
});

describe("ENG-6581 dashboards scope grant on registered clients", () => {
  beforeEach(async () => {
    await resetDb();
  });

  test("a client registered with the previous defaults gains both scopes, appended", async () => {
    const clientId = await seedClient(PRE_ENG6581_SCOPES);

    await runClientGrant();

    expect(await clientScopesOf(clientId)).toEqual([
      ...PRE_ENG6581_SCOPES,
      "dashboards:read",
      "dashboards:write",
    ]);
  });

  test("mirrors what the client holds: read-only stays read-only, write-only stays write-only", async () => {
    const readOnly = await seedClient(["responses:read", "offline_access"]);
    const writeOnly = await seedClient(["workflows:write"]);

    await runClientGrant();

    expect(await clientScopesOf(readOnly)).toEqual(["responses:read", "offline_access", "dashboards:read"]);
    expect(await clientScopesOf(writeOnly)).toEqual(["workflows:write", "dashboards:write"]);
  });

  test("a client with no MCP resource scope is left alone", async () => {
    const clientId = await seedClient(["openid", "profile", "email"]);

    await runClientGrant();

    expect(await clientScopesOf(clientId)).toEqual(["openid", "profile", "email"]);
  });

  test("a skipConsent client is left exactly as it was", async () => {
    // The provider issues a skipConsent client a code before any consent check, so widening it would
    // grant dashboard access with no prompt. Drop the clause and this goes red.
    const clientId = await seedClient(PRE_ENG6581_SCOPES, { skipConsent: true });

    await runClientGrant();

    expect(await clientScopesOf(clientId)).toEqual(PRE_ENG6581_SCOPES);
  });

  test("is idempotent and completes a partial apply without duplicates", async () => {
    const partial = await seedClient([...PRE_ENG6581_SCOPES, "dashboards:read"]);

    await runClientGrant();
    const afterFirst = await clientScopesOf(partial);
    await runClientGrant();

    expect(afterFirst).toEqual([...PRE_ENG6581_SCOPES, "dashboards:read", "dashboards:write"]);
    expect(await clientScopesOf(partial)).toEqual(afterFirst);
  });

  test("is a no-op on a fresh database", async () => {
    await expect(runClientGrant()).resolves.not.toThrow();
    expect(await prisma.oauthClient.count()).toBe(0);
  });
});
