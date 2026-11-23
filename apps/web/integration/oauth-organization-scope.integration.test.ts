import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { MCP_OAUTH_SCOPES } from "@/modules/auth/lib/oauth-urls";
// The data migrations under test (auto-discovered by the migration runner at deploy).
import { grantOrganizationScope } from "../../../packages/database/migration/20261123130000_grant_organization_scope/migration";
import { grantOrganizationScopeToClients } from "../../../packages/database/migration/20261123130001_grant_organization_scope_to_clients/migration";

/**
 * ENG-7479 against real Postgres: the two repairs that let upgraded instances grant `organization:read`, the
 * second read-only scope family. Same shape as the ENG-7151 audience suite: there is no
 * `organization:write`, so a client holding only write scopes gains nothing.
 */
const runResourceGrant = () => grantOrganizationScope.run!({ prisma, tx: prisma as never });
const runClientGrant = () => grantOrganizationScopeToClients.run!({ prisma, tx: prisma as never });

/** What an upgraded instance holds after ENG-7151, before this change. */
const PRE_ENG7479_SCOPES = [
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
  "audience:read",
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
  const clientId = `eng7479-client-${seq}`;
  await prisma.oauthClient.create({
    data: { clientId, redirectUris: ["http://127.0.0.1:33418/callback"], scopes, ...extra },
  });
  return clientId;
};

const clientScopesOf = async (clientId: string): Promise<string[]> =>
  (await prisma.oauthClient.findUniqueOrThrow({ where: { clientId }, select: { scopes: true } })).scopes;

describe("ENG-7479 organization scope grant on the MCP resource", () => {
  beforeEach(async () => {
    await resetDb();
  });

  test("appends organization:read to an upgraded row, keeping its order", async () => {
    await seedResource(MCP_IDENTIFIER, PRE_ENG7479_SCOPES);
    await runResourceGrant();
    expect(await resourceScopesOf(MCP_IDENTIFIER)).toEqual([...PRE_ENG7479_SCOPES, "organization:read"]);
  });

  test("leaves the row able to grant every scope the app advertises", async () => {
    await seedResource(MCP_IDENTIFIER, PRE_ENG7479_SCOPES);
    await runResourceGrant();
    const allowed = new Set(await resourceScopesOf(MCP_IDENTIFIER));
    expect(MCP_OAUTH_SCOPES.filter((scope) => !allowed.has(scope))).toEqual([]);
  });

  test("is idempotent and leaves a non-MCP resource alone", async () => {
    const other = "https://app.example.com/api/something-else";
    await seedResource(MCP_IDENTIFIER, PRE_ENG7479_SCOPES);
    await seedResource(other, ["surveys:read"]);
    await runResourceGrant();
    const afterFirst = await resourceScopesOf(MCP_IDENTIFIER);
    await runResourceGrant();
    expect(await resourceScopesOf(MCP_IDENTIFIER)).toEqual(afterFirst);
    expect(await resourceScopesOf(other)).toEqual(["surveys:read"]);
  });

  test("is a no-op on a fresh database", async () => {
    await expect(runResourceGrant()).resolves.not.toThrow();
    expect(await prisma.oauthResource.count()).toBe(0);
  });
});

describe("ENG-7479 organization scope grant on registered clients", () => {
  beforeEach(async () => {
    await resetDb();
  });

  test("a client holding any MCP read scope gains organization:read; a write-only client does not", async () => {
    const full = await seedClient(PRE_ENG7479_SCOPES);
    const readOnly = await seedClient(["audience:read", "offline_access"]);
    const writeOnly = await seedClient(["workflows:write"]);
    const noMcp = await seedClient(["openid", "profile", "email"]);

    await runClientGrant();

    expect(await clientScopesOf(full)).toEqual([...PRE_ENG7479_SCOPES, "organization:read"]);
    expect(await clientScopesOf(readOnly)).toEqual(["audience:read", "offline_access", "organization:read"]);
    expect(await clientScopesOf(writeOnly)).toEqual(["workflows:write"]);
    expect(await clientScopesOf(noMcp)).toEqual(["openid", "profile", "email"]);
  });

  test("a skipConsent client is left exactly as it was", async () => {
    // Widening a skipConsent client would hand out members' attributes with no prompt.
    const clientId = await seedClient(PRE_ENG7479_SCOPES, { skipConsent: true });
    await runClientGrant();
    expect(await clientScopesOf(clientId)).toEqual(PRE_ENG7479_SCOPES);
  });

  test("is idempotent", async () => {
    const clientId = await seedClient(PRE_ENG7479_SCOPES);
    await runClientGrant();
    await runClientGrant();
    expect((await clientScopesOf(clientId)).filter((scope) => scope === "organization:read")).toHaveLength(1);
  });
});
