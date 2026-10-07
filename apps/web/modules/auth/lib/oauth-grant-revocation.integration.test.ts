import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import {
  ORIGIN,
  createUser,
  grant as grantScopes,
  handle,
  refresh,
  registerClient,
  signIn as signInAs,
} from "@/integration/oauth-flow";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "./oauth-urls";

/**
 * ENG-2499 against the real Better Auth instance and a real Postgres: revoking an app on Authorized
 * Apps must end its access, not only delete the consent row.
 *
 * Every token here is minted by the provider through the real authorize → consent → token flow, never
 * seeded, because the refresh hook finds the presented token by restating the provider's storage hash.
 * A seeded token would be hashed by the code under test and prove nothing. The "refresh keeps working"
 * test is what fails if a provider upgrade changes that format: the hook fails closed.
 */
const EMAIL = "oauth-revoke@example.com";
const PASSWORD = "Correct-Horse1";
const SCOPE = ["surveys:read", "responses:read", "offline_access"].join(" ");

const signIn = () => signInAs(EMAIL, PASSWORD);
const registerRevokeClient = () => registerClient("ENG-2499 revoke test");
const grant = (cookie: string, clientId: string) => grantScopes(cookie, clientId, SCOPE);

const deleteConsentOverHttp = (cookie: string, id: string): Promise<Response> =>
  handle("/oauth2/delete-consent", {
    method: "POST",
    headers: { "content-type": "application/json", cookie, origin: ORIGIN },
    body: JSON.stringify({ id }),
  });

const consentOf = (userId: string, clientId: string) =>
  prisma.oauthConsent.findFirstOrThrow({ where: { userId, clientId }, select: { id: true } });

/** Refresh and access tokens that still work: not revoked and not expired. */
const liveTokens = async (userId: string, clientId: string): Promise<number> => {
  const where = { userId, clientId, revoked: null, expiresAt: { gt: new Date() } };
  const [refreshTokens, accessTokens] = await Promise.all([
    prisma.oauthRefreshToken.count({ where }),
    prisma.oauthAccessToken.count({ where }),
  ]);
  return refreshTokens + accessTokens;
};

beforeEach(async () => {
  await resetDb();
  // Instance-level, so resetDb clears it and only the first test gets the boot-time seed. That seed runs
  // in the background and can land at any point here, so the insert has to be atomic: `upsert` reads
  // then inserts and loses the race, `skipDuplicates` is a single INSERT … ON CONFLICT DO NOTHING.
  await prisma.oauthResource.createMany({
    data: [{ identifier: getMcpResourceUrl(), name: "Formbricks MCP", allowedScopes: [...MCP_OAUTH_SCOPES] }],
    skipDuplicates: true,
  });
  await createUser(EMAIL, PASSWORD, "Revoker");
});

describe("revoking an OAuth app ends its access (ENG-2499, real Postgres)", () => {
  test("refresh keeps working while the consent stands, across rotations", async () => {
    const { cookie } = await signIn();
    const clientId = await registerRevokeClient();
    const first = await grant(cookie, clientId);

    const second = await refresh(clientId, first.refresh_token);
    expect(second.status, JSON.stringify(second.body)).toBe(200);
    const third = await refresh(clientId, second.body.refresh_token as string);
    expect(third.status, JSON.stringify(third.body)).toBe(200);
  });

  test("revoking over HTTP deletes the consent and revokes the tokens; the next refresh is refused", async () => {
    const { cookie, userId } = await signIn();
    const clientId = await registerRevokeClient();
    const first = await grant(cookie, clientId);
    // A rotated chain as well as the original: every token of the grant has to go.
    const rotated = await refresh(clientId, first.refresh_token);
    const { id } = await consentOf(userId, clientId);

    const response = await deleteConsentOverHttp(cookie, id);

    expect(response.status).toBe(200);
    expect(await prisma.oauthConsent.count({ where: { userId, clientId } })).toBe(0);
    expect(await liveTokens(userId, clientId)).toBe(0);
    const after = await refresh(clientId, rotated.body.refresh_token as string);
    expect(after.status).toBe(400);
    expect(after.body.error).toBe("invalid_grant");
  });

  test("revoking through auth.api, the Authorized Apps action's path, does the same", async () => {
    const { cookie, userId } = await signIn();
    const clientId = await registerRevokeClient();
    const tokens = await grant(cookie, clientId);
    const { id } = await consentOf(userId, clientId);

    await auth.api.deleteOAuthConsent({ body: { id }, headers: new Headers({ cookie }) });

    expect(await prisma.oauthConsent.count({ where: { userId, clientId } })).toBe(0);
    expect(await liveTokens(userId, clientId)).toBe(0);
    expect((await refresh(clientId, tokens.refresh_token)).body.error).toBe("invalid_grant");
  });

  test("a grant revoked before this fix (consent gone, tokens live) is refused at its next refresh", async () => {
    const { cookie, userId } = await signIn();
    const clientId = await registerRevokeClient();
    const tokens = await grant(cookie, clientId);
    // What the upstream endpoint used to leave behind: the consent deleted, every token untouched.
    await prisma.oauthConsent.deleteMany({ where: { userId, clientId } });

    const after = await refresh(clientId, tokens.refresh_token);

    expect(after.status).toBe(400);
    expect(after.body.error).toBe("invalid_grant");
    expect(after.body).not.toHaveProperty("access_token");
    // The refresh token the provider minted during that request is revoked along with the rest.
    expect(await liveTokens(userId, clientId)).toBe(0);
  });

  test("a refresh racing an uncommitted revoke waits for it and is refused", async () => {
    const { cookie, userId } = await signIn();
    const clientId = await registerRevokeClient();
    const tokens = await grant(cookie, clientId);

    let settled = false;
    let raced: Promise<Awaited<ReturnType<typeof refresh>>> | undefined;
    // The revoke's consent delete holds the row lock while the refresh rotates. The token update is left
    // out on purpose: that is the interleaving where it already ran and missed the new token, so only the
    // refresh hook's FOR SHARE read of the consent can catch it.
    await prisma.$transaction(
      async (tx) => {
        await tx.oauthConsent.deleteMany({ where: { userId, clientId } });
        raced = refresh(clientId, tokens.refresh_token).finally(() => {
          settled = true;
        });
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        expect(settled, "the refresh answered before the revoke committed").toBe(false);
      },
      { timeout: 10_000 }
    );

    const after = await (raced as Promise<Awaited<ReturnType<typeof refresh>>>);
    expect(after.body.error).toBe("invalid_grant");
    expect(await liveTokens(userId, clientId)).toBe(0);
  });

  test("another user's consent id and an unknown id get the same 404, and nothing changes", async () => {
    const { cookie, userId } = await signIn();
    const clientId = await registerRevokeClient();
    const tokens = await grant(cookie, clientId);
    const { id } = await consentOf(userId, clientId);
    // The same consent, but owned by a user who is not the caller.
    const stranger = await prisma.user.create({ data: { email: "stranger@example.com", name: "Stranger" } });
    await prisma.oauthConsent.update({ where: { id }, data: { userId: stranger.id } });

    const foreign = await deleteConsentOverHttp(cookie, id);
    const unknown = await deleteConsentOverHttp(cookie, "clnonexistentconsent0000");

    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await foreign.json()).toEqual(await unknown.json());
    expect(await prisma.oauthConsent.count({ where: { id } })).toBe(1);
    expect(await liveTokens(userId, clientId)).toBeGreaterThan(0);
    // Hand the consent back: the caller's own grant was never touched and still refreshes.
    await prisma.oauthConsent.update({ where: { id }, data: { userId } });
    expect((await refresh(clientId, tokens.refresh_token)).status).toBe(200);
  });

  test("revoking one app leaves the user's other apps working", async () => {
    const { cookie, userId } = await signIn();
    const revokedClient = await registerRevokeClient();
    const keptClient = await registerRevokeClient();
    await grant(cookie, revokedClient);
    const kept = await grant(cookie, keptClient);

    await deleteConsentOverHttp(cookie, (await consentOf(userId, revokedClient)).id);

    expect(await liveTokens(userId, revokedClient)).toBe(0);
    expect((await refresh(keptClient, kept.refresh_token)).status).toBe(200);
  });

  test("a skipConsent client, which never has a consent row, is not refused", async () => {
    const { cookie, userId } = await signIn();
    const clientId = await registerRevokeClient();
    const tokens = await grant(cookie, clientId);
    await prisma.oauthClient.update({ where: { clientId }, data: { skipConsent: true } });
    await prisma.oauthConsent.deleteMany({ where: { userId, clientId } });

    expect((await refresh(clientId, tokens.refresh_token)).status).toBe(200);
  });

  test("without a session, revoking is refused and changes nothing", async () => {
    const { cookie, userId } = await signIn();
    const clientId = await registerRevokeClient();
    await grant(cookie, clientId);
    const { id } = await consentOf(userId, clientId);

    const response = await deleteConsentOverHttp("", id);

    expect(response.status).toBe(401);
    expect(await prisma.oauthConsent.count({ where: { id } })).toBe(1);
  });
});
