import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { MCP_OAUTH_SCOPES } from "@/modules/auth/lib/oauth-urls";
// The data migrations under test (auto-discovered by the migration runner at deploy).
import { grantAudienceScope } from "../../../packages/database/migration/20261112130000_grant_audience_scope/migration";
import { grantAudienceScopeToClients } from "../../../packages/database/migration/20261112130001_grant_audience_scope_to_clients/migration";

/**
 * ENG-7151 against real Postgres: the two repairs that let upgraded instances grant `audience:read`, the
 * first read-only scope family. Same shape as the ENG-6581 dashboards suite, with one difference that
 * matters: there is no `audience:write`, so a client holding only write scopes gains nothing.
 *
 * The runner supplies `run` with its interactive transaction; here `prisma` stands in.
 */
const runResourceGrant = () => grantAudienceScope.run!({ prisma, tx: prisma as never });
const runClientGrant = () => grantAudienceScopeToClients.run!({ prisma, tx: prisma as never });

/** What an upgraded instance holds after ENG-2862, ENG-3470 and ENG-6581, before this change. */
const PRE_ENG7151_SCOPES = [
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
  "dashboards:read",
  "dashboards:write",
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
  const clientId = `eng7151-client-${seq}`;
  await prisma.oauthClient.create({
    data: { clientId, redirectUris: ["http://127.0.0.1:33418/callback"], scopes, ...extra },
  });
  return clientId;
};

const clientScopesOf = async (clientId: string): Promise<string[]> =>
  (await prisma.oauthClient.findUniqueOrThrow({ where: { clientId }, select: { scopes: true } })).scopes;

describe("ENG-7151 audience scope grant on the MCP resource", () => {
  beforeEach(async () => {
    await resetDb();
  });

  test("appends audience:read to an upgraded row, keeping its order", async () => {
    await seedResource(MCP_IDENTIFIER, PRE_ENG7151_SCOPES);

    await runResourceGrant();

    expect(await resourceScopesOf(MCP_IDENTIFIER)).toEqual([...PRE_ENG7151_SCOPES, "audience:read"]);
  });

  test("leaves the row able to grant every scope the app advertises", async () => {
    await seedResource(MCP_IDENTIFIER, PRE_ENG7151_SCOPES);

    await runResourceGrant();

    const allowed = new Set(await resourceScopesOf(MCP_IDENTIFIER));
    expect(MCP_OAUTH_SCOPES.filter((scope) => !allowed.has(scope))).toEqual([]);
  });

  test("is idempotent — a second run changes nothing", async () => {
    await seedResource(MCP_IDENTIFIER, PRE_ENG7151_SCOPES);

    await runResourceGrant();
    const afterFirst = await resourceScopesOf(MCP_IDENTIFIER);
    await runResourceGrant();

    expect(await resourceScopesOf(MCP_IDENTIFIER)).toEqual(afterFirst);
  });

  test("leaves a non-MCP resource alone", async () => {
    const other = "https://app.example.com/api/something-else";
    await seedResource(MCP_IDENTIFIER, PRE_ENG7151_SCOPES);
    await seedResource(other, ["surveys:read"]);

    await runResourceGrant();

    expect(await resourceScopesOf(other)).toEqual(["surveys:read"]);
    expect(await resourceScopesOf(MCP_IDENTIFIER)).toContain("audience:read");
  });

  test("is a no-op on a fresh database", async () => {
    await expect(runResourceGrant()).resolves.not.toThrow();
    expect(await prisma.oauthResource.count()).toBe(0);
  });
});

describe("ENG-7151 audience scope grant on registered clients", () => {
  beforeEach(async () => {
    await resetDb();
  });

  test("a client registered with the previous defaults gains audience:read, appended", async () => {
    const clientId = await seedClient(PRE_ENG7151_SCOPES);

    await runClientGrant();

    expect(await clientScopesOf(clientId)).toEqual([...PRE_ENG7151_SCOPES, "audience:read"]);
  });

  test("a client holding any MCP read scope gains it; a write-only client does not", async () => {
    const readOnly = await seedClient(["dashboards:read", "offline_access"]);
    const writeOnly = await seedClient(["workflows:write"]);

    await runClientGrant();

    expect(await clientScopesOf(readOnly)).toEqual(["dashboards:read", "offline_access", "audience:read"]);
    expect(await clientScopesOf(writeOnly)).toEqual(["workflows:write"]);
  });

  test("a client with no MCP resource scope is left alone", async () => {
    const clientId = await seedClient(["openid", "profile", "email"]);

    await runClientGrant();

    expect(await clientScopesOf(clientId)).toEqual(["openid", "profile", "email"]);
  });

  test("a skipConsent client is left exactly as it was", async () => {
    // The provider issues a skipConsent client a code before any consent check, so widening it would
    // hand out contacts with no prompt. Drop the clause and this goes red.
    const clientId = await seedClient(PRE_ENG7151_SCOPES, { skipConsent: true });

    await runClientGrant();

    expect(await clientScopesOf(clientId)).toEqual(PRE_ENG7151_SCOPES);
  });

  test("is idempotent", async () => {
    const clientId = await seedClient(PRE_ENG7151_SCOPES);

    await runClientGrant();
    const afterFirst = await clientScopesOf(clientId);
    await runClientGrant();

    expect(await clientScopesOf(clientId)).toEqual(afterFirst);
    expect(afterFirst.filter((scope) => scope === "audience:read")).toHaveLength(1);
  });

  test("is a no-op on a fresh database", async () => {
    await expect(runClientGrant()).resolves.not.toThrow();
    expect(await prisma.oauthClient.count()).toBe(0);
  });
});
