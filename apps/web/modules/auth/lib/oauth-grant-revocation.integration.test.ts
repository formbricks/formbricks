import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import {
  ORIGIN,
  authorize,
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
 * ENG-2499 and ENG-3529 against the real Better Auth instance and a real Postgres: revoking an app on
 * Authorized Apps must end its access, not only delete the consent row, and narrowing an app's consent
 * must end every token that reaches past it.
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
const grant = (
  cookie: string,
  clientId: string,
  { scope = SCOPE, prompt }: { scope?: string; prompt?: "consent" } = {}
) => grantScopes(cookie, clientId, scope, { prompt });

const deleteConsentOverHttp = (cookie: string, id: string): Promise<Response> =>
  handle("/oauth2/delete-consent", {
    method: "POST",
    headers: { "content-type": "application/json", cookie, origin: ORIGIN },
    body: JSON.stringify({ id }),
  });

const consentOf = (userId: string, clientId: string) =>
  prisma.oauthConsent.findFirstOrThrow({ where: { userId, clientId }, select: { id: true, scopes: true } });

/** Refresh and access tokens that still work: not revoked and not expired. */
const liveTokens = async (userId: string, clientId: string): Promise<number> => {
  const where = { userId, clientId, revoked: null, expiresAt: { gt: new Date() } };
  const [refreshTokens, accessTokens] = await Promise.all([
    prisma.oauthRefreshToken.count({ where }),
    prisma.oauthAccessToken.count({ where }),
  ]);
  return refreshTokens + accessTokens;
};

/** Live refresh tokens carrying `scope`, i.e. ones that could still mint an access token with it. */
const liveRefreshTokensWith = (userId: string, clientId: string, scope: string): Promise<number> =>
  prisma.oauthRefreshToken.count({
    where: { userId, clientId, revoked: null, expiresAt: { gt: new Date() }, scopes: { has: scope } },
  });

/**
 * Resolves once a refresh's `FOR SHARE` read of the consent is blocked on a row lock, i.e. the refresh has
 * issued its tokens and is waiting on the uncommitted consent write. Fails if that never happens, so the
 * race tests can't pass by the refresh simply running after the commit.
 */
const waitForConsentReadToBlock = async (): Promise<void> => {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS "waiting" FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND query LIKE '%FROM "oauthConsent"%FOR SHARE%'`;
    if (waiting > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("the refresh never blocked on the consent row lock");
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
        await waitForConsentReadToBlock();
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

describe("narrowing an OAuth app's consent ends the tokens beyond it (ENG-3529, real Postgres)", () => {
  // The same grant without respondent data. It keeps `offline_access`, so the narrowed grant still gets
  // a refresh token, which has to keep working.
  const NARROW = ["surveys:read", "offline_access"].join(" ");

  test("re-approving with fewer scopes revokes the older tokens; the narrowed grant keeps refreshing", async () => {
    const { cookie, userId } = await signIn();
    const clientId = await registerRevokeClient();
    const wide = await grant(cookie, clientId);
    const rotated = await refresh(clientId, wide.refresh_token);

    const narrow = await grant(cookie, clientId, { scope: NARROW, prompt: "consent" });

    expect((await consentOf(userId, clientId)).scopes.sort()).toEqual(NARROW.split(" ").sort());
    expect(await liveRefreshTokensWith(userId, clientId, "responses:read")).toBe(0);
    // The client still holds the older chain, the token it rotated away included. Presenting either is
    // refused, and doesn't trip the provider's reuse detection, which would end the narrowed grant too.
    for (const stale of [rotated.body.refresh_token as string, wide.refresh_token]) {
      const after = await refresh(clientId, stale);
      expect(after.status).toBe(400);
      expect(after.body.error).toBe("invalid_grant");
      expect(after.body).not.toHaveProperty("access_token");
    }
    const kept = await refresh(clientId, narrow.refresh_token);
    expect(kept.status, JSON.stringify(kept.body)).toBe(200);
    expect((kept.body.scope as string).split(" ").sort()).toEqual(NARROW.split(" ").sort());
  });

  test("narrowing through update-consent revokes the tokens beyond it", async () => {
    const { cookie, userId } = await signIn();
    const clientId = await registerRevokeClient();
    const wide = await grant(cookie, clientId);
    const { id } = await consentOf(userId, clientId);

    const response = await handle("/oauth2/update-consent", {
      method: "POST",
      headers: { "content-type": "application/json", cookie, origin: ORIGIN },
      body: JSON.stringify({ id, update: { scopes: NARROW.split(" ") } }),
    });

    expect(response.status).toBe(200);
    expect(await liveTokens(userId, clientId)).toBe(0);
    expect((await refresh(clientId, wide.refresh_token)).body.error).toBe("invalid_grant");
  });

  test("narrowing revokes opaque access tokens beyond it, and narrowing to nothing ends every token", async () => {
    const { cookie, userId } = await signIn();
    const clientId = await registerRevokeClient();
    await grant(cookie, clientId);
    const { id } = await consentOf(userId, clientId);
    // MCP grants carry the resource, so they get JWTs and no access-token row. Opaque ones are looked up
    // by their value, not hashed by the code under test, so seeding them is a fair stand-in.
    const opaque = (scopes: string[]) =>
      prisma.oauthAccessToken.create({
        data: {
          token: randomBytes(16).toString("hex"),
          clientId,
          userId,
          scopes,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 15 * 60_000),
        },
        select: { id: true },
      });
    const [wideAccess, narrowAccess] = [await opaque(SCOPE.split(" ")), await opaque(NARROW.split(" "))];
    const updateConsent = (scopes: string[]) =>
      handle("/oauth2/update-consent", {
        method: "POST",
        headers: { "content-type": "application/json", cookie, origin: ORIGIN },
        body: JSON.stringify({ id, update: { scopes } }),
      });
    const isRevoked = async (tokenId: string) =>
      (await prisma.oauthAccessToken.findUniqueOrThrow({ where: { id: tokenId } })).revoked !== null;

    expect((await updateConsent(NARROW.split(" "))).status).toBe(200);
    expect(await isRevoked(wideAccess.id)).toBe(true);
    expect(await isRevoked(narrowAccess.id)).toBe(false);

    expect((await updateConsent([])).status).toBe(200);
    expect(await isRevoked(narrowAccess.id)).toBe(true);
    expect(await liveTokens(userId, clientId)).toBe(0);
  });

  test("a grant narrowed before this fix (consent narrowed, tokens live) is refused at its next refresh", async () => {
    const { cookie, userId } = await signIn();
    const clientId = await registerRevokeClient();
    const wide = await grant(cookie, clientId);
    // What a narrowed approval used to leave behind: the consent replaced, every token untouched.
    await prisma.oauthConsent.updateMany({
      where: { userId, clientId },
      data: { scopes: NARROW.split(" ") },
    });

    const after = await refresh(clientId, wide.refresh_token);

    expect(after.status).toBe(400);
    expect(after.body.error).toBe("invalid_grant");
    expect(after.body).not.toHaveProperty("access_token");
    // The refresh token the provider minted during that request is revoked along with the rest.
    expect(await liveTokens(userId, clientId)).toBe(0);
  });

  test("asking for fewer scopes on refresh doesn't rescue a token from before the narrowing", async () => {
    const { cookie, userId } = await signIn();
    const clientId = await registerRevokeClient();
    const wide = await grant(cookie, clientId);
    await prisma.oauthConsent.updateMany({
      where: { userId, clientId },
      data: { scopes: NARROW.split(" ") },
    });

    // Every scope asked for is inside the consent, but the token presented was minted beyond it.
    const after = await refresh(clientId, wide.refresh_token, NARROW);

    expect(after.status).toBe(400);
    expect(after.body.error).toBe("invalid_grant");
    // Including the narrower refresh token the provider minted for this request, which never left.
    expect(await liveTokens(userId, clientId)).toBe(0);
  });

  test("a refused pre-1.7 grant, which has no grant id, still loses the token minted for the refresh", async () => {
    const { cookie, userId } = await signIn();
    const clientId = await registerRevokeClient();
    const wide = await grant(cookie, clientId);
    // Grants from before Better Auth 1.7 carry no authorizationCodeId, and rotation keeps it that way.
    await prisma.oauthRefreshToken.updateMany({
      where: { userId, clientId },
      data: { authorizationCodeId: null },
    });
    await prisma.oauthConsent.updateMany({
      where: { userId, clientId },
      data: { scopes: NARROW.split(" ") },
    });

    const after = await refresh(clientId, wide.refresh_token, NARROW);

    expect(after.body.error).toBe("invalid_grant");
    // The narrower token the provider minted for this request is inside the consent, but never left.
    expect(await liveTokens(userId, clientId)).toBe(0);
  });

  test("with two consent rows from a racing first approval, narrowing either one is what counts", async () => {
    const { cookie, userId } = await signIn();
    const clientId = await registerRevokeClient();
    const wide = await grant(cookie, clientId);
    const first = await consentOf(userId, clientId);
    // Both rows list the wide scopes; the provider's own row is pushed back so the narrowing below is
    // unambiguously the newest write.
    const earlier = new Date(Date.now() - 60_000);
    await prisma.oauthConsent.update({ where: { id: first.id }, data: { updatedAt: earlier } });
    const second = await prisma.oauthConsent.create({
      data: { clientId, userId, scopes: SCOPE.split(" "), createdAt: earlier, updatedAt: earlier },
    });

    const response = await handle("/oauth2/update-consent", {
      method: "POST",
      headers: { "content-type": "application/json", cookie, origin: ORIGIN },
      body: JSON.stringify({ id: second.id, update: { scopes: NARROW.split(" ") } }),
    });

    expect(response.status).toBe(200);
    expect(await liveRefreshTokensWith(userId, clientId, "responses:read")).toBe(0);
    expect((await refresh(clientId, wide.refresh_token)).body.error).toBe("invalid_grant");
    // The stale wide row is gone, so /authorize can't find it and skip the consent screen.
    const consents = await prisma.oauthConsent.findMany({ where: { userId, clientId } });
    expect(consents.map((consent) => [consent.id, consent.scopes.sort()])).toEqual([
      [second.id, NARROW.split(" ").sort()],
    ]);
    const { target } = await authorize(cookie, clientId, SCOPE);
    expect(target.searchParams.get("code")).toBeNull();
    expect(target.pathname).toBe("/account/authorize");
  });

  test("a narrower child minted from a wide grant before the narrowing ends with its grant", async () => {
    const { cookie, userId } = await signIn();
    const clientId = await registerRevokeClient();
    const wide = await grant(cookie, clientId);
    // A refresh that asks for fewer scopes mints a child inside the narrowing to come.
    const child = await refresh(clientId, wide.refresh_token, NARROW);
    expect(child.status, JSON.stringify(child.body)).toBe(200);
    expect((child.body.scope as string).split(" ").sort()).toEqual(NARROW.split(" ").sort());
    const { id } = await consentOf(userId, clientId);

    await handle("/oauth2/update-consent", {
      method: "POST",
      headers: { "content-type": "application/json", cookie, origin: ORIGIN },
      body: JSON.stringify({ id, update: { scopes: NARROW.split(" ") } }),
    });

    expect(await liveTokens(userId, clientId)).toBe(0);
    expect((await refresh(clientId, child.body.refresh_token as string)).body.error).toBe("invalid_grant");
  });

  test("narrowing one app leaves the user's other apps and other users' tokens alone", async () => {
    const { cookie, userId } = await signIn();
    const narrowed = await registerRevokeClient();
    const other = await registerRevokeClient();
    await grant(cookie, narrowed);
    const otherTokens = await grant(cookie, other);
    // Another user's wide grant for the narrowed client, as stored rows: they're never presented here.
    const stranger = await prisma.user.create({ data: { email: "stranger@example.com", name: "Stranger" } });
    const inAQuarterHour = new Date(Date.now() + 15 * 60_000);
    await prisma.oauthRefreshToken.create({
      data: {
        token: randomBytes(16).toString("hex"),
        clientId: narrowed,
        userId: stranger.id,
        scopes: SCOPE.split(" "),
        createdAt: new Date(),
        expiresAt: inAQuarterHour,
      },
    });
    await prisma.oauthAccessToken.create({
      data: {
        token: randomBytes(16).toString("hex"),
        clientId: narrowed,
        userId: stranger.id,
        scopes: SCOPE.split(" "),
        createdAt: new Date(),
        expiresAt: inAQuarterHour,
      },
    });
    const { id } = await consentOf(userId, narrowed);

    await handle("/oauth2/update-consent", {
      method: "POST",
      headers: { "content-type": "application/json", cookie, origin: ORIGIN },
      body: JSON.stringify({ id, update: { scopes: NARROW.split(" ") } }),
    });

    expect(await liveTokens(userId, narrowed)).toBe(0);
    expect(await liveTokens(stranger.id, narrowed)).toBe(2);
    expect((await refresh(other, otherTokens.refresh_token)).status).toBe(200);
  });

  test("a refresh racing an uncommitted narrowing waits for it and is refused", async () => {
    const { cookie, userId } = await signIn();
    const clientId = await registerRevokeClient();
    const wide = await grant(cookie, clientId);

    let settled = false;
    let raced: Promise<Awaited<ReturnType<typeof refresh>>> | undefined;
    // The narrowing's consent update holds the row lock while the refresh rotates, as the provider's own
    // update does between its write and its commit.
    await prisma.$transaction(
      async (tx) => {
        await tx.oauthConsent.updateMany({
          where: { userId, clientId },
          data: { scopes: NARROW.split(" ") },
        });
        raced = refresh(clientId, wide.refresh_token).finally(() => {
          settled = true;
        });
        await waitForConsentReadToBlock();
        expect(settled, "the refresh answered before the narrowing committed").toBe(false);
      },
      { timeout: 10_000 }
    );

    const after = await (raced as Promise<Awaited<ReturnType<typeof refresh>>>);
    expect(after.body.error).toBe("invalid_grant");
    expect(await liveTokens(userId, clientId)).toBe(0);
  });

  test("re-approving the same scopes, or more, leaves the older tokens working", async () => {
    const { cookie } = await signIn();
    const clientId = await registerRevokeClient();
    const first = await grant(cookie, clientId, { scope: NARROW });

    await grant(cookie, clientId, { prompt: "consent" });
    await grant(cookie, clientId, { prompt: "consent" });

    const after = await refresh(clientId, first.refresh_token);
    expect(after.status, JSON.stringify(after.body)).toBe(200);
  });
});
