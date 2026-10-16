import { createHash, randomBytes } from "node:crypto";
import { generateSync } from "otplib";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  BASE_URL,
  ORIGIN,
  createUser,
  grant,
  handle,
  registerClient,
  signIn,
  token,
} from "@/integration/oauth-flow";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";

/**
 * ENG-3933: an MCP authorization pending while a user with 2FA signs in must only complete once the
 * second factor does. Better Auth runs plugin after hooks in list order; with `oauthProvider()` ahead
 * of `twoFactor()`, a correct password alone resumed the authorization with the session 2FA then
 * withdrew, and a browser navigation got the authorization code back in `Location`.
 *
 * Drives the real provider through `auth.handler`, as the browser's login page does: the
 * `oauthProviderClient` plugin adds the signed query to every request from that page, so both the
 * password step and the TOTP step carry it.
 */
const REDIRECT_URI = "http://127.0.0.1:33418/callback";
const EMAIL = "mcp-2fa@example.com";
const PASSWORD = "Mcp-2fa-Passw0rd!";
const SCOPE = "surveys:read offline_access";

type TMode = "navigate" | "fetch";

const requestHeaders = (mode: TMode, cookie?: string): Record<string, string> => ({
  "content-type": "application/json",
  origin: ORIGIN,
  ...(mode === "navigate"
    ? { "sec-fetch-mode": "navigate", accept: "text/html" }
    : { accept: "application/json" }),
  ...(cookie ? { cookie } : {}),
});

const cookiesOf = (response: Response): string =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

/** An authorization code the response hands back, in `Location` (a navigation) or the JSON `url`. */
const codeIn = async (response: Response): Promise<string | null> => {
  const body = await response.text();
  const json = body ? (JSON.parse(body) as { url?: string }) : {};
  const urls = [response.headers.get("location"), json.url];
  for (const url of urls) {
    const code = url ? new URL(url, BASE_URL).searchParams.get("code") : null;
    if (code) return code;
  }
  return null;
};

/** A user with TOTP who has consented to the client once, signed in with both factors. */
const consentingTwoFactorUser = async (): Promise<{ clientId: string; secret: string; userId: string }> => {
  await createUser(EMAIL, PASSWORD, "Mcp 2FA");
  const { cookie, userId } = await signIn(EMAIL, PASSWORD);
  const enrolled = await auth.api.enableTwoFactor({ body: { password: PASSWORD }, headers: { cookie } });
  if (enrolled.method !== "totp") throw new Error(`expected a TOTP enrolment, got "${enrolled.method}"`);
  const secret = /[?&]secret=([^&]+)/.exec(enrolled.totpURI)?.[1] as string;
  // Turning 2FA on swaps the session for a new one: carry on with the cookie it returns.
  const enrolledCookie = cookiesOf(
    await auth.api.verifyTOTP({
      body: { code: generateSync({ secret }) },
      headers: { cookie },
      asResponse: true,
    })
  );
  const clientId = await registerClient("MCP client");
  await grant(enrolledCookie, clientId, SCOPE);
  await prisma.session.deleteMany();
  return { clientId, secret, userId };
};

/** Starts an authorization while signed out: the provider sends the browser to log in with a signed query. */
const startAuthorization = async (clientId: string): Promise<{ signedQuery: string; verifier: string }> => {
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
  return { signedQuery: login.search.slice(1), verifier };
};

/**
 * Counts authorization codes as the provider mints them, delivered or not: on a fetch the old order
 * minted one too, it just never reached the caller (the 2FA challenge replaced the response body).
 */
const watchAuthorizationCodes = async (): Promise<() => number> => {
  const { internalAdapter } = await auth.$context;
  const spy = vi.spyOn(internalAdapter, "createVerificationValue");
  return () =>
    spy.mock.calls.filter(([data]) => {
      try {
        return (JSON.parse(data.value) as { type?: string }).type === "authorization_code";
      } catch {
        return false;
      }
    }).length;
};

const passwordStep = (mode: TMode, signedQuery: string) =>
  handle("/sign-in/email", {
    method: "POST",
    headers: requestHeaders(mode),
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, oauth_query: signedQuery }),
  });

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(async () => {
  await resetDb();
  // The MCP resource is seeded once per instance, so resetDb clears it after the first test; re-seed it
  // atomically, as the boot-time seed may land concurrently (see oauth-grant-revocation.integration.test.ts).
  await prisma.oauthResource.createMany({
    data: [{ identifier: getMcpResourceUrl(), name: "Formbricks MCP", allowedScopes: [...MCP_OAUTH_SCOPES] }],
    skipDuplicates: true,
  });
});

describe("MCP authorization for a user with two-factor authentication (real Postgres)", () => {
  test.each<TMode>(["navigate", "fetch"])(
    "a password alone yields the 2FA challenge and no authorization code (%s)",
    async (mode) => {
      const { clientId } = await consentingTwoFactorUser();
      const { signedQuery } = await startAuthorization(clientId);
      const authorizationCodes = await watchAuthorizationCodes();

      const response = await passwordStep(mode, signedQuery);

      expect(authorizationCodes()).toBe(0);
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(await response.json()).toMatchObject({ twoFactorRedirect: true });
      expect(await prisma.session.count()).toBe(0);
    }
  );

  test.each<TMode>(["navigate", "fetch"])(
    "the second factor completes the authorization, and its code exchanges for tokens (%s)",
    async (mode) => {
      const { clientId, secret, userId } = await consentingTwoFactorUser();
      const { signedQuery, verifier } = await startAuthorization(clientId);
      const challenge = await passwordStep(mode, signedQuery);
      await challenge.text();
      const authorizationCodes = await watchAuthorizationCodes();

      const totp = await handle("/two-factor/verify-totp", {
        method: "POST",
        headers: requestHeaders(mode, cookiesOf(challenge)),
        body: JSON.stringify({ code: generateSync({ secret }), oauth_query: signedQuery }),
      });
      const code = await codeIn(totp);
      expect(code).toBeTruthy();
      expect(authorizationCodes()).toBe(1);

      const exchanged = await token({
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        code_verifier: verifier,
        resource: getMcpResourceUrl(),
      });
      expect(exchanged.status, JSON.stringify(exchanged.body)).toBe(200);
      expect(exchanged.body).toHaveProperty("access_token");
      // The token is issued to the user whose second factor completed the sign-in.
      const [, payload] = String(exchanged.body.access_token).split(".");
      expect((JSON.parse(Buffer.from(payload, "base64url").toString()) as { sub?: string }).sub).toBe(userId);
    }
  );
});
