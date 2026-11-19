import { randomUUID } from "node:crypto";
import { createClient } from "redis";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { POST } from "@/app/api/auth/[...all]/route";
import { REDIRECT_URI, registerClient } from "@/integration/oauth-flow";
import { OAUTH_CALLBACK_URL_MAX_BYTES, OAUTH_QUERY_MAX_BYTES } from "./oauth-state-bounds";
import { getMcpResourceUrl } from "./oauth-urls";

/**
 * ENG-6885: starting an OAuth sign-in is anonymous, and Better Auth keeps the caller's `additionalData` and
 * callback URLs in the OAuth state record in Redis for 10 minutes. Without a bound, one request parked up
 * to the 256 KiB body limit there. Driven through the real auth route and Redis, because the property is
 * what Better Auth writes, and a version bump can add a field without touching our diff.
 *
 * `saml` is the provider under test because its endpoints are explicit URLs, so starting a sign-in makes
 * no outbound call (same setup as oauth-state-cookie.integration.test.ts). Every built-in and generic
 * provider starts through the same `/sign-in/social` endpoint.
 */

vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  ENTERPRISE_LICENSE_KEY: "integration-license",
  SAML_OAUTH_ENABLED: true,
}));

vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsSsoEnabled: vi.fn(async () => true),
  getIsSamlSsoEnabled: vi.fn(async () => true),
}));

const BASE = "http://localhost:3000";
const LARGE = "x".repeat(250 * 1024);
const inspector = createClient({ url: process.env.REDIS_URL });

beforeAll(async () => {
  await inspector.connect();
});

afterAll(async () => {
  await inspector.quit();
});

/** The response, and the bytes of every Redis value the request wrote. */
const signInSocial = async (body: Record<string, unknown>) => {
  const before = new Set(await inspector.keys("*"));
  const response = await POST(
    new Request(`${BASE}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({ provider: "saml", callbackURL: "/", errorCallbackURL: "/auth/login", ...body }),
    })
  );
  const created = (await inspector.keys("*")).filter((key) => !before.has(key));
  const sizes = await Promise.all(created.map((key) => inspector.strLen(key)));
  return { status: response.status, storedBytes: sizes.reduce((sum, size) => sum + size, 0) };
};

/**
 * The signed `oauth_query` an anonymous MCP client gets back from `/oauth2/authorize`: the login page
 * receives it and sends it on with the sign-in, and oauth-provider puts it in the state record as
 * `serverContext`. Every parameter is the caller's own, and anyone can register a client (open DCR).
 */
const signedAuthorizeQuery = async (clientId: string, state: string): Promise<string> => {
  const response = await POST(
    new Request(`${BASE}/api/auth/oauth2/authorize`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        scope: "openid profile email offline_access",
        code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        code_challenge_method: "S256",
        resource: getMcpResourceUrl(),
        state,
      }),
    })
  );
  const { url } = (await response.json()) as { url?: string };
  const query = new URL(url ?? "", BASE).search.slice(1);
  expect(query, `no signed query (status ${response.status})`).toContain("sig=");
  return query;
};

describe("OAuth state record size (ENG-6885)", () => {
  test("an honest sign-in still starts and stores a small state", async () => {
    const { status, storedBytes } = await signInSocial({ callbackURL: "/environments/abc?source=signin" });
    expect(status).toBe(200);
    expect(storedBytes).toBeGreaterThan(0);
    expect(storedBytes).toBeLessThan(2 * 1024);
  });

  test("additionalData is refused and nothing is stored", async () => {
    expect(await signInSocial({ additionalData: { x: LARGE } })).toEqual({ status: 400, storedBytes: 0 });
  });

  test.each(["callbackURL", "errorCallbackURL", "newUserCallbackURL"])(
    "a %s over the limit is refused and nothing is stored",
    async (field) => {
      expect(await signInSocial({ [field]: `/${LARGE}` })).toEqual({ status: 400, storedBytes: 0 });
    }
  );

  test("callback URLs at the limit still start a sign-in, and bound the state record", async () => {
    const atLimit = `/${"a".repeat(OAUTH_CALLBACK_URL_MAX_BYTES - 1)}`;
    const { status, storedBytes } = await signInSocial({
      callbackURL: atLimit,
      errorCallbackURL: atLimit,
      newUserCallbackURL: atLimit,
    });
    expect(status).toBe(200);
    expect(storedBytes).toBeLessThan(3 * OAUTH_CALLBACK_URL_MAX_BYTES + 2 * 1024);
  });

  test("an MCP client's honest signed query still starts a sign-in", async () => {
    const oauthQuery = await signedAuthorizeQuery(await registerClient("eng-6885 honest"), randomUUID());
    expect(Buffer.byteLength(oauthQuery)).toBeLessThan(OAUTH_QUERY_MAX_BYTES);

    const { status, storedBytes } = await signInSocial({ oauth_query: oauthQuery });
    expect(status).toBe(200);
    expect(storedBytes).toBeLessThan(OAUTH_QUERY_MAX_BYTES);
  });

  test("a signed query over the limit is refused and nothing is stored", async () => {
    const oauthQuery = await signedAuthorizeQuery(
      await registerClient("eng-6885 oversized"),
      LARGE.slice(0, 200 * 1024)
    );

    expect(await signInSocial({ oauth_query: oauthQuery })).toEqual({ status: 400, storedBytes: 0 });
    // The same signed query as JSON key/value pairs: oauth-provider reads it with `new URLSearchParams`,
    // which takes pairs too, so the signature still verifies.
    expect(await signInSocial({ oauth_query: [...new URLSearchParams(oauthQuery)] })).toEqual({
      status: 400,
      storedBytes: 0,
    });
  });
});
