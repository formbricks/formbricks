import { beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import {
  ORIGIN,
  authorize,
  createUser,
  grant,
  handle,
  refresh,
  registerClient,
  signIn,
} from "@/integration/oauth-flow";
import { resetDb } from "@/integration/reset-db";
import { updateMembership } from "@/modules/ee/role-management/lib/membership";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "./oauth-urls";

/**
 * ENG-6903 / ENG-6889 against the real Better Auth instance and Postgres: a user who is only a Dashboard
 * viewer grants an MCP client `dashboards:read` and nothing else, whatever the client asks for, and the
 * token endpoint never mints them anything wider, including from a grant they gave as a Member.
 */
const PASSWORD = "Correct-Horse1";
const EVERYTHING = MCP_OAUTH_SCOPES.join(" ");
const VIEWER_GRANT = ["openid", "profile", "email", "offline_access", "dashboards:read"];

const scopesOf = (scope: string) => scope.split(" ").filter(Boolean).sort();

let seq = 0;
const userWithRole = async (role: "dashboard_viewer" | "member") => {
  seq += 1;
  const email = `oauth-viewer-${seq}@example.com`;
  await createUser(email, PASSWORD, "Viewer");
  const organization = await prisma.organization.create({ data: { name: `Org ${seq}` } });
  const { cookie, userId } = await signIn(email, PASSWORD);
  await prisma.membership.create({
    data: { userId, organizationId: organization.id, role, accepted: true },
  });
  return { cookie, userId, organizationId: organization.id };
};

const consentWith = (cookie: string, oauthQuery: string, scope?: string) =>
  handle("/oauth2/consent", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", cookie, origin: ORIGIN },
    body: JSON.stringify({ accept: true, oauth_query: oauthQuery, ...(scope ? { scope } : {}) }),
  });

let clientId = "";

describe("a Dashboard viewer's OAuth grant", () => {
  // One client for the file: registration is rate limited, and each test signs in its own user, whose
  // consents and tokens are theirs alone.
  beforeAll(async () => {
    await resetDb();
    await prisma.oauthResource.createMany({
      data: [
        { identifier: getMcpResourceUrl(), name: "Formbricks MCP", allowedScopes: [...MCP_OAUTH_SCOPES] },
      ],
      skipDuplicates: true,
    });
    clientId = await registerClient("dashboard viewer client");
  });

  test("asking for every scope grants only dashboards:read, identity and refresh", async () => {
    const { cookie, userId } = await userWithRole("dashboard_viewer");

    const tokens = await grant(cookie, clientId, EVERYTHING);

    expect(scopesOf(tokens.scope)).toEqual([...VIEWER_GRANT].sort());
    const consent = await prisma.oauthConsent.findFirstOrThrow({ where: { userId, clientId } });
    expect([...consent.scopes].sort()).toEqual([...VIEWER_GRANT].sort());
  });

  test("a consent page that sends wider scopes is narrowed by the server", async () => {
    const { cookie } = await userWithRole("dashboard_viewer");
    const { target } = await authorize(cookie, clientId, EVERYTHING);

    const response = await consentWith(
      cookie,
      target.search.slice(1),
      "surveys:read responses:read dashboards:read"
    );

    expect(response.status).toBe(200);
    const { url } = (await response.json()) as { url: string };
    expect(new URL(url).searchParams.get("code")).toBeTruthy();
  });

  test("a client that asks for no dashboard access is denied", async () => {
    const { cookie } = await userWithRole("dashboard_viewer");
    const { target } = await authorize(cookie, clientId, "surveys:read responses:read offline_access");

    const response = await consentWith(cookie, target.search.slice(1));

    expect(response.status).toBe(403);
  });

  test("a refresh never widens a viewer's grant", async () => {
    const { cookie, userId } = await userWithRole("dashboard_viewer");
    const tokens = await grant(cookie, clientId, EVERYTHING);

    const refreshed = await refresh(clientId, tokens.refresh_token, EVERYTHING);

    expect(refreshed.status).not.toBe(200);
    const plain = await refresh(clientId, tokens.refresh_token);
    if (plain.status === 200) {
      expect(scopesOf(String(plain.body.scope))).toEqual([...VIEWER_GRANT].sort());
    }
    expect(await prisma.oauthRefreshToken.count({ where: { userId, scopes: { has: "surveys:read" } } })).toBe(
      0
    );
  });

  test("a Member's wide grant ends when they are made a Dashboard viewer", async () => {
    const { cookie, userId, organizationId } = await userWithRole("member");
    const tokens = await grant(cookie, clientId, EVERYTHING);
    expect(scopesOf(tokens.scope)).toContain("surveys:read");

    await updateMembership(userId, organizationId, { role: "dashboard_viewer" });

    expect((await refresh(clientId, tokens.refresh_token)).status).not.toBe(200);
    expect(await prisma.oauthConsent.count({ where: { userId } })).toBe(0);

    // Authorizing again goes through consent, which now offers only dashboards:read.
    const again = await grant(cookie, clientId, EVERYTHING);
    expect(scopesOf(again.scope)).toEqual([...VIEWER_GRANT].sort());
  });

  test("a Member is unaffected", async () => {
    const { cookie } = await userWithRole("member");

    const tokens = await grant(cookie, clientId, EVERYTHING);

    expect(scopesOf(tokens.scope)).toEqual([...MCP_OAUTH_SCOPES].sort());
  });
});
