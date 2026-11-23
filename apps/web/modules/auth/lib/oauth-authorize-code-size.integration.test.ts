import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { GET, POST } from "@/app/api/auth/[...all]/route";
import { REDIRECT_URI, consent, createUser, grant, registerClient, signIn } from "@/integration/oauth-flow";
import { createRedisBytesWritten } from "@/integration/redis-bytes-written";
import { resetDb } from "@/integration/reset-db";
import { OAUTH_AUTHORIZE_PARAMS_MAX_BYTES } from "./oauth-record-bounds";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "./oauth-urls";

/**
 * ENG-7396: once a user has consented to a client, every `/oauth2/authorize` call issues a code at once,
 * and oauth-provider stores the code with the whole authorize request in Redis for 10 minutes. Its schema
 * caps no string and passes unknown keys through, so one call parked ~200 KB there. Driven through the real
 * auth route and Redis, because the property is what oauth-provider writes.
 */

const BASE = "http://localhost:3000";
const SCOPE = ["surveys:read", "responses:read", "offline_access"].join(" ");
const LARGE = "x".repeat(200 * 1024);
const redis = createRedisBytesWritten();

let cookie = "";
let clientId = "";

beforeAll(async () => {
  await redis.connect();
  // A clean instance, so sign-up is open for the test user whichever file ran first; the MCP resource is
  // instance-level and seeded the way oauth-grant-revocation.integration.test.ts does it.
  await resetDb();
  await prisma.oauthResource.createMany({
    data: [{ identifier: getMcpResourceUrl(), name: "Formbricks MCP", allowedScopes: [...MCP_OAUTH_SCOPES] }],
    skipDuplicates: true,
  });
  const email = `eng-7396-${randomUUID()}@example.com`;
  await createUser(email, "Integration-Pass-7396!", "ENG-7396");
  cookie = (await signIn(email, "Integration-Pass-7396!")).cookie;
  clientId = await registerClient("eng-7396");
  // The one consent; every authorize call after it gets a code without the consent screen.
  await grant(cookie, clientId, SCOPE);
});

afterAll(async () => {
  await redis.quit();
});

const authorizeParams = (extra: Record<string, string> = {}) =>
  new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    code_challenge_method: "S256",
    resource: getMcpResourceUrl(),
    state: randomUUID(),
    ...extra,
  });

/** Status, whether a code was issued, and the bytes the call left in Redis. */
const authorize = async (method: "GET" | "POST", extra: Record<string, string> = {}) => {
  const params = authorizeParams(extra);
  const headers = { accept: "application/json", cookie, origin: BASE };
  const { result, storedBytes } = await redis.measure(() =>
    method === "GET"
      ? GET(new Request(`${BASE}/api/auth/oauth2/authorize?${params}`, { headers }))
      : POST(
          new Request(`${BASE}/api/auth/oauth2/authorize`, {
            method: "POST",
            headers: { ...headers, "content-type": "application/x-www-form-urlencoded" },
            body: params,
          })
        )
  );
  const body = await result.text();
  // An authorize refusal names its OAuth error, so a 400 from anything but the guard doesn't pass for one.
  const error = (JSON.parse(body || "{}") as { error?: string }).error;
  return {
    status: result.status,
    codeIssued: body.includes("code="),
    storedBytes,
    ...(error ? { error } : {}),
  };
};

describe("authorization code record size (ENG-7396)", () => {
  test.each(["GET", "POST"] as const)("an honest %s authorize still issues a code", async (method) => {
    const { status, codeIssued, storedBytes } = await authorize(method);
    expect(status).toBe(200);
    expect(codeIssued).toBe(true);
    expect(storedBytes).toBeGreaterThan(0);
    expect(storedBytes).toBeLessThan(2 * 1024);
  });

  test.each(["GET", "POST"] as const)(
    "a padded state on %s is refused and nothing is stored",
    async (method) => {
      expect(await authorize(method, { state: LARGE })).toEqual({
        status: 400,
        error: "invalid_request",
        codeIssued: false,
        storedBytes: 0,
      });
    }
  );

  test.each(["GET", "POST"] as const)(
    "a padded extra parameter on %s is refused and nothing is stored",
    async (method) => {
      // The schema passes unknown keys through into the stored request, so capping known ones is not enough.
      // 12 KB rather than 200 KB on GET, which Node itself refuses past its 16 KiB header limit.
      expect(await authorize(method, { x_padding: "x".repeat(12 * 1024) })).toEqual({
        status: 400,
        error: "invalid_request",
        codeIssued: false,
        storedBytes: 0,
      });
    }
  );

  test("parameters exactly at the limit still issue a code, and one byte more is refused", async () => {
    // The guard counts the parameters as Redis holds them: a JSON object inside the record's JSON string.
    const stored = (extra: Record<string, string>) =>
      Buffer.byteLength(JSON.stringify(JSON.stringify(Object.fromEntries(authorizeParams(extra))))) - 2;
    const base = stored({ state: "fixed-state", x_padding: "" });
    const pad = "a".repeat(OAUTH_AUTHORIZE_PARAMS_MAX_BYTES - base);

    const atLimit = await authorize("POST", { state: "fixed-state", x_padding: pad });
    expect(atLimit).toMatchObject({ status: 200, codeIssued: true });
    expect(await authorize("POST", { state: "fixed-state", x_padding: `${pad}a` })).toEqual({
      status: 400,
      error: "invalid_request",
      codeIssued: false,
      storedBytes: 0,
    });
  });

  test("many short parameters are measured with the JSON around each", async () => {
    // 90 extra keys whose names and values total under the cap: only the quotes, colons and commas Redis
    // would hold around each one take the request over it.
    const extra = Object.fromEntries(
      Array.from({ length: 90 }, (_, i) => [`k${String(i).padStart(2, "0")}`, "v".repeat(78)])
    );
    const text = [...authorizeParams(extra)].reduce(
      (sum, [name, value]) => sum + Buffer.byteLength(name + value),
      0
    );
    expect(text).toBeLessThan(OAUTH_AUTHORIZE_PARAMS_MAX_BYTES);

    expect(await authorize("POST", extra)).toEqual({
      status: 400,
      error: "invalid_request",
      codeIssued: false,
      storedBytes: 0,
    });
  });

  test("a state of control characters is measured as stored", async () => {
    // 1,200 raw bytes; Redis would hold each \u0001 escaped twice, as 7 bytes.
    expect(await authorize("POST", { state: "\u0001".repeat(1_200) })).toEqual({
      status: 400,
      error: "invalid_request",
      codeIssued: false,
      storedBytes: 0,
    });
  });

  test("a near-limit request still completes through consent", async () => {
    // The consent step replays the signed request into authorize, with the signed query in its own body.
    // Only the replayed request is stored, so only it counts.
    const freshClient = await registerClient("eng-7396 consent");
    const params = authorizeParams({ client_id: freshClient, state: "s".repeat(6_000) });
    const started = await POST(
      new Request(`${BASE}/api/auth/oauth2/authorize`, {
        method: "POST",
        headers: {
          accept: "application/json",
          cookie,
          origin: BASE,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: params,
      })
    );
    const { url } = (await started.json()) as { url?: string };
    const consentPage = new URL(url ?? "", BASE);
    expect(consentPage.pathname, `status ${started.status}`).toBe("/account/authorize");

    const approved = await consent(cookie, consentPage, { accept: true });
    const { url: redirect } = (await approved.json()) as { url?: string };
    expect(approved.status).toBe(200);
    expect(new URL(redirect ?? "", BASE).searchParams.get("code")).toBeTruthy();
  });
});
