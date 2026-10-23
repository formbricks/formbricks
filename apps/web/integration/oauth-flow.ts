import { createHash, randomBytes } from "node:crypto";
import { expect } from "vitest";
import { prisma } from "@formbricks/database";
import { auth } from "@/modules/auth/lib/auth";
import { getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";

/**
 * Drives the real MCP OAuth flow against the real Better Auth instance: DCR, authorize, consent, code
 * exchange and refresh, all through `auth.handler`. Tokens come out of the provider rather than being
 * seeded, so whatever the provider stores and checks is what the suites exercise.
 */
export const BASE_URL = "http://localhost:3000";
export const ORIGIN = BASE_URL;
const REDIRECT_URI = "http://127.0.0.1:33418/callback";

const base64Url = (buffer: Buffer): string => buffer.toString("base64url");

export const handle = (path: string, init: RequestInit = {}): Promise<Response> =>
  auth.handler(new Request(`${BASE_URL}/api/auth${path}`, { redirect: "manual", ...init }));

/** Signs up a verified user. */
export const createUser = async (email: string, password: string, name: string): Promise<void> => {
  await auth.api.signUpEmail({ body: { email, password, name } });
  await prisma.user.update({ where: { email }, data: { emailVerified: true } });
};

export const signIn = async (
  email: string,
  password: string
): Promise<{ cookie: string; userId: string }> => {
  const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  return { cookie, userId: user.id };
};

/** Registers a public native client through DCR, as an MCP client does. */
export const registerClient = async (clientName: string): Promise<string> => {
  const response = await handle("/oauth2/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: clientName,
      redirect_uris: [REDIRECT_URI],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: "native",
    }),
  });
  const body = (await response.json()) as { client_id?: string };
  expect(response.status, JSON.stringify(body)).toBe(201);
  return body.client_id as string;
};

/** Reads the redirect target from a 302 or, when the request didn't accept HTML, the JSON `url`. */
const redirectTarget = async (response: Response): Promise<URL> => {
  const location =
    response.headers.get("location") ?? ((await response.json()) as { url?: string; redirect?: string }).url;
  expect(location, `no redirect (status ${response.status})`).toBeTruthy();
  return new URL(location as string, BASE_URL);
};

type TAuthorizeRequest = { target: URL; verifier: string };

/**
 * Starts `/oauth2/authorize` as the signed-in user. The target is the consent page when the user has to
 * approve the scopes, or the redirect URI carrying a `code` when an existing consent already covers them.
 */
export const authorize = async (
  cookie: string,
  clientId: string,
  scope: string,
  { prompt }: { prompt?: "consent" } = {}
): Promise<TAuthorizeRequest> => {
  const verifier = base64Url(randomBytes(32));
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope,
    code_challenge: base64Url(createHash("sha256").update(verifier).digest()),
    code_challenge_method: "S256",
    resource: getMcpResourceUrl(),
    state: "state",
    // `prompt=consent` forces the consent screen even when an existing consent covers `scope`, which is
    // how a client re-asks for fewer scopes.
    ...(prompt ? { prompt } : {}),
  });
  const target = await redirectTarget(await handle(`/oauth2/authorize?${query}`, { headers: { cookie } }));
  return { target, verifier };
};

export const token = async (
  body: Record<string, string>
): Promise<{ status: number; body: Record<string, unknown> }> => {
  const response = await handle("/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
};

export type TTokens = { access_token: string; refresh_token: string; scope: string };

/** authorize → consent (when asked for) → code exchange, as the signed-in user. */
export const grant = async (
  cookie: string,
  clientId: string,
  scope: string,
  options: { prompt?: "consent" } = {}
): Promise<TTokens> => {
  const { verifier, target: authorizeTarget } = await authorize(cookie, clientId, scope, options);
  let target = authorizeTarget;
  if (!target.searchParams.get("code")) {
    expect(target.pathname).toBe("/account/authorize");
    target = await redirectTarget(
      await handle("/oauth2/consent", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", cookie, origin: ORIGIN },
        body: JSON.stringify({ accept: true, oauth_query: target.search.slice(1) }),
      })
    );
  }
  const code = target.searchParams.get("code");
  expect(code, target.toString()).toBeTruthy();

  const response = await token({
    grant_type: "authorization_code",
    code: code as string,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    code_verifier: verifier,
    resource: getMcpResourceUrl(),
  });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body as TTokens;
};

/** A refresh grant; `scope` is sent only when given, as RFC 6749 §6 makes it optional. */
export const refresh = (clientId: string, refreshToken: string, scope?: string) =>
  token({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    ...(scope ? { scope } : {}),
  });
