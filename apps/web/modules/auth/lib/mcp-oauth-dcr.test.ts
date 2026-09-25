import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { jwt } from "better-auth/plugins";
import { NextRequest } from "next/server";
import { describe, expect, test, vi } from "vitest";
import { GET as getProtectedResourceMetadata } from "@/app/.well-known/oauth-protected-resource/[[...resource]]/route";
import { prepareDcrRequest, withInferredApplicationType } from "./mcp-dcr-application-type";
import { getMcpOauthProviderOptions } from "./mcp-oauth-provider-options";
import { getAuthIssuerUrl, getMcpResourceUrl, getOAuthUserInfoUrl } from "./oauth-urls";

// Env-dependent URL getters pinned; scope constants stay real — the whole point of this suite
// is to exercise the actual advertised-scope → DCR → authorize chain (ENG-1055).
vi.mock("@/lib/env", () => ({
  env: {
    WEBAPP_URL: "http://localhost:3000",
    BETTER_AUTH_URL: undefined,
    NEXTAUTH_URL: undefined,
    PUBLIC_URL: undefined,
  },
}));

const BASE_URL = "http://localhost:3000";
const REDIRECT_URI = "http://127.0.0.1:33418/callback";

/**
 * A registration exactly as an MCP client sends it: a loopback callback and no `application_type`.
 * Shared by the two suites below, which read it from opposite ends — one asks what upstream does with
 * it, the other that our own gate lets it through untouched.
 */
const LOOPBACK_REGISTRATION = JSON.stringify({
  client_name: "MCP DCR client that omits application_type",
  redirect_uris: [REDIRECT_URI],
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  token_endpoint_auth_method: "none",
  scope: "surveys:read",
});

/**
 * Regression suite for the MCP OAuth handshake as REAL clients drive it (Claude Code, MCP
 * Inspector): they read `scopes_supported` from the RFC 9728 protected-resource metadata, do
 * Dynamic Client Registration with exactly those scopes, then request the same scopes at
 * /authorize. The oauth-provider plugin validates /authorize against the client's REGISTERED
 * scopes, so any advertised-but-not-registered scope aborts login with invalid_scope — which is
 * how the missing offline_access advertisement broke every MCP-client login. A pre-seeded
 * full-scope client would mask that bug, so this suite must register via DCR only.
 */
const createAuthInstance = () => {
  // memoryAdapter needs every model it will touch declared up front — it does not create them
  // lazily. Better Auth 1.7 added the resource tables, and without them the plugin's boot-time
  // resource seeding logs `Model oauthResource not found in the DB` and every authorize fails.
  const db: Record<string, unknown[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
    jwks: [],
    oauthClient: [],
    oauthAccessToken: [],
    oauthRefreshToken: [],
    oauthConsent: [],
    oauthResource: [],
    oauthClientResource: [],
    oauthClientAssertion: [],
  };
  return betterAuth({
    baseURL: BASE_URL,
    secret: "mcp-oauth-dcr-test-secret",
    database: memoryAdapter(db),
    // jwt is a hard dependency of oauthProvider; configured as in production auth.ts.
    plugins: [
      jwt({
        disableSettingJwtHeader: true,
        jwt: { issuer: getAuthIssuerUrl(), audience: getMcpResourceUrl() },
      }),
      oauthProvider(getMcpOauthProviderOptions()),
    ],
  });
};

const fetchAdvertisedScopes = async (): Promise<string[]> => {
  const response = await getProtectedResourceMetadata(
    new NextRequest(`${BASE_URL}/.well-known/oauth-protected-resource/api/mcp`),
    { params: Promise.resolve({ resource: ["api", "mcp"] }) }
  );
  const metadata = (await response.json()) as { scopes_supported: string[] };
  return metadata.scopes_supported;
};

const registerClient = async (auth: ReturnType<typeof createAuthInstance>, scopes: string[]) => {
  const response = await auth.handler(
    new Request(`${BASE_URL}/api/auth/oauth2/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "MCP DCR test client",
        redirect_uris: [REDIRECT_URI],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        // Better Auth 1.7 validates redirect URIs against the OIDC application type, and DCR without
        // an explicit `application_type` defaults to "web" — for which ANY loopback redirect URI is
        // refused. MCP clients listen on a loopback port, so they are native clients and must say so.
        // See the sibling test below, which pins the refusal.
        application_type: "native",
        scope: scopes.join(" "),
      }),
    })
  );

  return { status: response.status, body: (await response.json()) as { client_id?: string; scope?: string } };
};

const requestAuthorize = async (
  auth: ReturnType<typeof createAuthInstance>,
  clientId: string,
  scopes: string[]
) => {
  const query = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: scopes.join(" "),
    state: "test-state",
    // PKCE is mandatory for public clients and for offline_access requests.
    code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    code_challenge_method: "S256",
  });

  const response = await auth.handler(
    new Request(`${BASE_URL}/api/auth/oauth2/authorize?${query.toString()}`, { redirect: "manual" })
  );

  return { status: response.status, location: response.headers.get("location") ?? "" };
};

describe("MCP OAuth Dynamic Client Registration → authorize (real-client shape)", () => {
  test("limits access tokens to the single MCP resource audience", () => {
    const { resources } = getMcpOauthProviderOptions();

    expect(resources).toHaveLength(1);
    expect(resources?.[0]).toMatchObject({ identifier: getMcpResourceUrl() });
  });

  /**
   * The MCP resource server allow-lists the AS's UserInfo endpoint as a second acceptable audience,
   * because the provider appends it to `aud` whenever `openid` is in the granted scopes. Every other
   * test compares our derivation of that URL to our own derivation, which would hold for any string
   * — including a wrong one. Asserting against the instance's own discovery document is what pins the
   * equality the allow-list actually depends on: the provider builds `userinfo_endpoint` and the
   * appended audience from the same `${baseURL}/oauth2/userinfo` expression.
   */
  test("the UserInfo audience we allow-list is the one the provider stamps", async () => {
    const auth = createAuthInstance();

    const response = await auth.handler(new Request(`${BASE_URL}/api/auth/.well-known/openid-configuration`));
    const { userinfo_endpoint: userinfoEndpoint } = (await response.json()) as {
      userinfo_endpoint: string;
    };

    expect(userinfoEndpoint).toBe(getOAuthUserInfoUrl());
  });

  /**
   * The 1.7 redirect-URI rules (ENG-2343), and the fix for them.
   *
   * An MCP client registers a loopback callback such as http://127.0.0.1:PORT/callback. Under 1.7 that
   * is legal only for a *native* client: DCR hardcodes the `application_type` default to "web", and
   * `validateClientRedirectUri` refuses every loopback URI for web clients — so a client that omits the
   * field is rejected before the user ever sees a consent screen. 1.6 had no such validation, so this
   * regressed working clients, and neither the default (a literal at the call site, not an option) nor
   * the clients are ours to change.
   *
   * These two tests are a pair: the first pins what upstream does, which is why the normalizer exists;
   * the second proves the normalizer actually resolves it against that same real validator. Note the
   * body is IDENTICAL in both — only `withInferredApplicationType` is applied.
   */
  const register = (auth: ReturnType<typeof createAuthInstance>, body: string) =>
    auth.handler(
      new Request(`${BASE_URL}/api/auth/oauth2/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      })
    );

  test("upstream refuses a loopback redirect URI when the client does not declare itself native", async () => {
    const response = await register(createAuthInstance(), LOOPBACK_REGISTRATION);
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_redirect_uri");
  });

  test("the inferred application_type makes that same registration succeed", async () => {
    const response = await register(createAuthInstance(), withInferredApplicationType(LOOPBACK_REGISTRATION));
    const body = (await response.json()) as { client_id?: string; application_type?: string; error?: string };

    expect(body.error).toBeUndefined();
    expect(response.status).toBeLessThan(300);
    expect(body.client_id).toBeTruthy();
  });

  /**
   * The security boundary the inference leans on. It fires whenever ANY redirect URI is http loopback,
   * which is deliberately wider than "all of them" — a native client may legitimately pair a loopback
   * URI with an https one. That widening is only safe because `native` does not relax the rule for a
   * non-loopback http URI, so being labelled native can never be a route to registering one. Asserted
   * against the real validator rather than reasoned about, because the whole class of bug here is
   * upstream changing a rule we assumed.
   */
  test("being labelled native does not let a non-loopback http redirect register", async () => {
    const payload = JSON.stringify({
      client_name: "Mixed Client",
      redirect_uris: ["http://127.0.0.1:9999/callback", "http://evil.example.com/callback"],
      token_endpoint_auth_method: "none",
    });
    const inferred = withInferredApplicationType(payload);

    // The inference does fire on this shape …
    expect(JSON.parse(inferred).application_type).toBe("native");

    // … and upstream still refuses the registration.
    const response = await register(createAuthInstance(), inferred);
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_redirect_uri");
  });

  test("PRM-advertised scopes register verbatim, including offline_access", async () => {
    const auth = createAuthInstance();
    const advertisedScopes = await fetchAdvertisedScopes();

    expect(advertisedScopes).toContain("offline_access");

    const registration = await registerClient(auth, advertisedScopes);

    // 201 Created since 1.7 (RFC 7591 §3.2.1).
    expect(registration.status).toBe(201);
    expect(registration.body.client_id).toBeTruthy();
    // The registered scope set is what /authorize validates against — offline_access must survive.
    expect(registration.body.scope?.split(" ")).toEqual(expect.arrayContaining(advertisedScopes));
  });

  test("default registration (no scope requested) grants read + write", async () => {
    const auth = createAuthInstance();

    // A client that registers without an explicit scope must receive write by default — otherwise the
    // consent screen only offers "Read surveys" and every write tool 403s (the ENG-1055 QA regression:
    // clients that key off the challenge/defaults rather than the PRM never requested write).
    const response = await auth.handler(
      new Request(`${BASE_URL}/api/auth/oauth2/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_name: "MCP DCR default-scope client",
          redirect_uris: [REDIRECT_URI],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
          application_type: "native",
        }),
      })
    );
    const body = (await response.json()) as { scope?: string };

    // Better Auth 1.7 returns 201 Created here, per RFC 7591 §3.2.1; 1.6 answered 200.
    expect(response.status).toBe(201);
    expect(body.scope?.split(" ")).toEqual(
      expect.arrayContaining([
        "surveys:read",
        "surveys:write",
        "workflows:read",
        "workflows:write",
        "offline_access",
      ])
    );
  });

  test("authorize accepts the PRM-advertised scopes for a DCR client (no invalid_scope)", async () => {
    const auth = createAuthInstance();
    const advertisedScopes = await fetchAdvertisedScopes();
    const registration = await registerClient(auth, advertisedScopes);
    const clientId = registration.body.client_id;
    expect(clientId).toBeTruthy();

    // Real clients (Claude Code, MCP Inspector) request offline_access at /authorize regardless
    // of the advertisement — they want a refresh token. Model that exactly: registered scopes
    // came from the PRM, authorize adds offline_access on top.
    const authorizeScopes = Array.from(new Set([...advertisedScopes, "offline_access"]));
    const authorize = await requestAuthorize(auth, clientId as string, authorizeScopes);

    // Scope validation happens before the session check, so a passing request redirects to the
    // login page — NOT back to redirect_uri with error=invalid_scope (the ENG-1055 failure mode).
    expect(authorize.location).not.toContain("error=invalid_scope");
    expect(authorize.location).toContain("/auth/login");
  });

  /**
   * Behaviour change in Better Auth 1.7, pinned deliberately (ENG-2343).
   *
   * In 1.6 a client was registered with exactly the scopes it asked for, so a client that requested
   * `surveys:read` could not later authorize `offline_access` — authorize answered `invalid_scope`.
   * In 1.7 `clientRegistrationDefaultScopes` is applied regardless of what the client requested, so
   * every DCR client is registered with the full advertised set and a narrower request no longer
   * constrains it.
   *
   * That removes a boundary: a client can no longer self-limit at registration. It does NOT grant
   * anything by itself — the token still only carries the scopes the user approves at consent, the
   * per-tool guards check the token's scopes, and workspace permissions bound what those can reach.
   * But "registered read-only" is no longer a thing, so it is asserted here rather than assumed.
   */
  test("registration grants the full default scope set even when the client asks for less", async () => {
    const auth = createAuthInstance();

    const registration = await registerClient(auth, ["surveys:read"]);
    const clientId = registration.body.client_id;
    expect(clientId).toBeTruthy();

    expect(registration.body.scope?.split(" ")).toEqual(expect.arrayContaining(["surveys:write"]));

    // Consequence: a scope the client never requested is now accepted at authorize.
    //
    // Asserted as a positive outcome, not as the absence of one error string. `requestAuthorize`
    // defaults `location` to "" when the header is missing, and "" satisfies every `not.toContain` —
    // so a negative assertion here would also pass if authorize returned a different error, or no
    // redirect at all. What an accepted request actually does, unauthenticated, is bounce to the
    // configured loginPage carrying no `error`.
    const authorize = await requestAuthorize(auth, clientId as string, ["surveys:read", "offline_access"]);
    expect(authorize.location).toBeTruthy();

    const location = new URL(authorize.location, BASE_URL);
    expect(location.pathname).toBe("/auth/login");
    expect(location.searchParams.get("error")).toBeNull();
  });

  test("authorize still rejects a scope outside the advertised set entirely", async () => {
    const auth = createAuthInstance();
    const registration = await registerClient(auth, ["surveys:read"]);

    const authorize = await requestAuthorize(auth, registration.body.client_id as string, [
      "surveys:read",
      "billing:admin",
    ]);

    expect(authorize.location).toContain("error=invalid_scope");
  });
});

/**
 * The DCR redirect-URI allowlist (ENG-3086) against the REAL plugin, which is the only place its two
 * load-bearing assumptions can be checked. The allowlist is a pre-handler gate keyed on the request
 * path, so it is only complete while upstream agrees with it about (a) which paths reach
 * `/oauth2/register` and (b) which bodies that endpoint will parse. Either could change under a
 * version bump, and either changing silently reopens the hole — a path upstream routes but the gate
 * does not match is a bypass, not a 404. So both are asserted here rather than reasoned about, the
 * same discipline as the `application_type` pair above.
 */
describe("DCR redirect-URI allowlist vs. the real plugin (ENG-3086)", () => {
  const REGISTER_PATH = "/api/auth/oauth2/register";

  /** The pentest report's payload, byte for byte (ENG-3086). */
  const REPORTED_REGISTRATION = JSON.stringify({
    client_name: "SecurityResearchVerify1",
    redirect_uris: ["https://attacker-controlled-test.example.org/cb"],
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });

  const registrationRequest = (path: string, body: string, contentType = "application/json") =>
    new Request(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });

  /** The route's real pipeline: the gate first, then Better Auth for whatever it lets through. */
  const throughRoute = async (auth: ReturnType<typeof createAuthInstance>, request: Request) => {
    const prepared = await prepareDcrRequest(request);
    return prepared instanceof Response ? prepared : auth.handler(prepared);
  };

  test("upstream alone registers the reported attacker client", async () => {
    const response = await createAuthInstance().handler(
      registrationRequest(REGISTER_PATH, REPORTED_REGISTRATION)
    );
    const body = (await response.json()) as { client_id?: string };

    // The vulnerability itself: an anonymous caller, an attacker-controlled https redirect, a
    // client_id back. This is what the gate below has to be measured against.
    expect(response.status).toBe(201);
    expect(body.client_id).toBeTruthy();
  });

  test("the gate rejects that same registration before upstream sees it", async () => {
    const response = await throughRoute(
      createAuthInstance(),
      registrationRequest(REGISTER_PATH, REPORTED_REGISTRATION)
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_redirect_uri");
  });

  test("a loopback MCP registration still reaches upstream and registers", async () => {
    const response = await throughRoute(
      createAuthInstance(),
      registrationRequest(REGISTER_PATH, LOOPBACK_REGISTRATION)
    );
    const body = (await response.json()) as { client_id?: string };

    // Through the gate AND through the application_type inference — the shape a real MCP client sends.
    expect(response.status).toBe(201);
    expect(body.client_id).toBeTruthy();
  });

  // Paths the gate matches. `..` and a query string are the two that would slip past a naive
  // pathname comparison, so they are pinned as matched rather than left to the router.
  test.each([REGISTER_PATH, `${REGISTER_PATH}?x=1`, "/api/auth/x/../oauth2/register"])(
    "the gate matches %s",
    async (path) => {
      const response = await throughRoute(
        createAuthInstance(),
        registrationRequest(path, REPORTED_REGISTRATION)
      );

      expect(response.status).toBe(400);
    }
  );

  // …and the mirror image: every near-miss spelling the gate does NOT match must be a path upstream
  // does not route either. A 201 here would mean the allowlist can be walked around by rewriting the
  // URL, which is the failure mode a pre-handler gate has and a plugin-level hook would not.
  test.each([
    `${REGISTER_PATH}/`,
    "/api/auth/oauth2/REGISTER",
    "/api/auth/oauth2/regis%74er",
    "/api/auth//oauth2/register",
    `${REGISTER_PATH}.`,
    `${REGISTER_PATH};x`,
    `${REGISTER_PATH}%20`,
  ])("upstream does not route %s, which the gate deliberately ignores", async (path) => {
    // Returned as the very same object: the gate does not read this request at all, let alone judge it.
    const probe = registrationRequest(path, REPORTED_REGISTRATION);
    expect(await prepareDcrRequest(probe)).toBe(probe);

    const response = await createAuthInstance().handler(registrationRequest(path, REPORTED_REGISTRATION));

    expect(response.status).toBe(404);
  });

  // The other half of the same question: the gate reads the body as JSON, so a content type upstream
  // would parse some other way would be a bypass. Upstream accepts application/json only.
  test("upstream refuses a form-encoded registration outright", async () => {
    const response = await createAuthInstance().handler(
      registrationRequest(
        REGISTER_PATH,
        `redirect_uris[]=${encodeURIComponent("https://attacker-controlled-test.example.org/cb")}`,
        "application/x-www-form-urlencoded"
      )
    );

    expect(response.status).toBe(415);
  });
});
