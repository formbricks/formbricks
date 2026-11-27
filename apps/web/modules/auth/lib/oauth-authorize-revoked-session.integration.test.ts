import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import {
  BASE_URL,
  REDIRECT_URI,
  authorize,
  consent,
  createUser,
  grant,
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
