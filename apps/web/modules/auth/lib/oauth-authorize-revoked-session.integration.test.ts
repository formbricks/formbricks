import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import {
  BASE_URL,
  ORIGIN,
  REDIRECT_URI,
  authorize,
  consent,
  createUser,
  grant,
  handle,
  registerClient,
  signIn,
} from "@/integration/oauth-flow";
import { resetDb } from "@/integration/reset-db";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
import { revokeUserSessionsExcept } from "@/modules/auth/lib/session-revocation";

/**
 * GHSA-fvxx-76fc-893x, the part Better Auth 1.7.16 leaves open: the OAuth provider resolves the browser's
 * session with `getSessionFromCtx`, which trusts a still-valid `session_data` cookie (`cookieCache`, 5 min)
 * without asking Redis or Postgres. A session revoked in both stores could still mint an authorization
 * code, and a grant outlives the session. `oauthGrantReadsSessionStoreBeforeHandler` strips that cookie
 * from the three routes that mint one, so they read the store.
 */
const EMAIL = "revoked-authorize@example.com";
const PASSWORD = "Revoked-Authorize-Passw0rd!";
const SCOPE = "surveys:read offline_access";

/** The code an authorize or consent response hands back, wherever it put the redirect. */
const codeIn = async (response: Response): Promise<string | null> => {
  const body = await response.text();
  const json = body.startsWith("{") ? (JSON.parse(body) as { url?: string }) : {};
  for (const url of [response.headers.get("location"), json.url]) {
    const code = url ? new URL(url, BASE_URL).searchParams.get("code") : null;
    if (code) return code;
  }
  return null;
};

/** A signed-in user holding the whole cookie jar, `session_data` included, who has consented once. */
const signedInConsentedUser = async () => {
  await createUser(EMAIL, PASSWORD, "Revoked Authorize");
  const { cookie, userId } = await signIn(EMAIL, PASSWORD);
  // The premise: without the cache cookie this test would pass for the wrong reason.
  expect(cookie).toContain("session_data");
  const clientId = await registerClient("MCP client");
  await grant(cookie, clientId, SCOPE);
  return { cookie, userId, clientId };
};

/**
 * A pending authorization the way the login page holds it: `/oauth2/authorize` while signed out answers with
 * a redirect to sign in, carrying the signed query that `/oauth2/continue` later resumes.
 */
const pendingAuthorization = async (clientId: string): Promise<string> => {
  const verifier = randomBytes(32).toString("base64url");
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    resource: getMcpResourceUrl(),
    state: "state",
  });
  const response = await handle(`/oauth2/authorize?${query}`, { headers: { accept: "text/html" } });
  const login = new URL(response.headers.get("location") ?? "", BASE_URL);
  expect(login.pathname).toBe("/auth/login");
  return login.search.slice(1);
};

const continueAuthorization = (cookie: string, signedQuery: string) =>
  handle("/oauth2/continue", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", cookie, origin: ORIGIN },
    body: JSON.stringify({ selected: true, oauth_query: signedQuery }),
  });

beforeEach(async () => {
  await resetDb();
  await prisma.oauthResource.createMany({
    data: [{ identifier: getMcpResourceUrl(), name: "Formbricks MCP", allowedScopes: [...MCP_OAUTH_SCOPES] }],
    skipDuplicates: true,
  });
});

describe("OAuth authorization with a revoked session (real Postgres and Valkey)", () => {
  test("a live session with a prior consent still gets its authorization code", async () => {
    const { cookie, clientId } = await signedInConsentedUser();

    const { target } = await authorize(cookie, clientId, SCOPE);

    expect(target.searchParams.get("code")).toBeTruthy();
    expect(target.origin + target.pathname).toBe(REDIRECT_URI);
  });

  test("/oauth2/authorize sends a revoked session to sign in instead of minting a code", async () => {
    const { cookie, userId, clientId } = await signedInConsentedUser();
    await revokeUserSessionsExcept({ userId });
    expect(await prisma.session.count()).toBe(0);

    const { target } = await authorize(cookie, clientId, SCOPE);

    expect(target.searchParams.get("code")).toBeNull();
    expect(target.pathname).toBe("/auth/login");
  });

  test("a cache cookie written with whitespace before the = does not get past the hook", async () => {
    const { cookie, userId, clientId } = await signedInConsentedUser();
    // Both of Better Auth's cookie parsers trim the name, so this is still the cache cookie to them.
    const spaced = cookie.replace(/(session_data(?:\.\d+)?)=/g, "$1 =");
    expect(spaced).not.toBe(cookie);
    await revokeUserSessionsExcept({ userId });

    const { target } = await authorize(spaced, clientId, SCOPE);

    expect(target.searchParams.get("code")).toBeNull();
    expect(target.pathname).toBe("/auth/login");
  });

  test("/oauth2/continue resumes a pending authorization for a live session, and not for a revoked one", async () => {
    const { cookie, userId, clientId } = await signedInConsentedUser();
    const signedQuery = await pendingAuthorization(clientId);

    expect(await codeIn(await continueAuthorization(cookie, signedQuery))).toBeTruthy();

    await revokeUserSessionsExcept({ userId });

    expect(await codeIn(await continueAuthorization(cookie, signedQuery))).toBeNull();
  });

  test("/oauth2/update-consent does not widen a stored consent for a revoked session", async () => {
    const { cookie, userId } = await signedInConsentedUser();
    const stored = await prisma.oauthConsent.findFirstOrThrow({ where: { userId } });
    await revokeUserSessionsExcept({ userId });

    const response = await handle("/oauth2/update-consent", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", cookie, origin: ORIGIN },
      body: JSON.stringify({ id: stored.id, update: { scopes: ["surveys:read", "surveys:write"] } }),
    });

    expect(response.status).toBe(401);
    expect((await prisma.oauthConsent.findUniqueOrThrow({ where: { id: stored.id } })).scopes).toEqual(
      stored.scopes
    );
  });

  test("/oauth2/consent does not turn a revoked session's approval into a code", async () => {
    const { cookie, userId } = await signedInConsentedUser();
    const freshClientId = await registerClient("Second MCP client");
    const { target } = await authorize(cookie, freshClientId, SCOPE);
    expect(target.pathname).toBe("/account/authorize");
    await revokeUserSessionsExcept({ userId });

    const response = await consent(cookie, target, { accept: true });

    expect(await codeIn(response)).toBeNull();
    expect(await prisma.oauthConsent.count({ where: { clientId: freshClientId } })).toBe(0);
  });
});
