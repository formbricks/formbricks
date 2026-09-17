import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthMiddleware } from "better-auth/api";
import { genericOAuth, jwt, twoFactor } from "better-auth/plugins";
import { createHash } from "node:crypto";
import { authenticator } from "otplib";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { getMcpOauthProviderOptions } from "./mcp-oauth-provider-options";
import { withNativeAuthAudit } from "./native-auth-audit";
import { withNativeAuthAuditAdapter } from "./native-auth-audit-adapter";
import { captureTwoFactorAuditPrincipal } from "./native-auth-audit-principal";

vi.unmock("crypto");
vi.unmock("node:crypto");

const settings = vi.hoisted(() => ({ enabled: true }));
vi.mock("@/lib/constants", () => ({
  get AUDIT_LOG_ENABLED() {
    return settings.enabled;
  },
}));
vi.mock("@/lib/env", () => ({ env: { WEBAPP_URL: "http://localhost:3000" } }));
vi.mock("@formbricks/logger", () => ({ logger: { audit: vi.fn(), error: vi.fn() } }));

const baseURL = "http://localhost:3000";
const password = "Never-log-this-password-123!";
const setup = () => {
  const db: Record<string, Record<string, unknown>[]> = Object.fromEntries(
    [
      "user",
      "account",
      "session",
      "verification",
      "twoFactor",
      "jwks",
      "oauthClient",
      "oauthConsent",
      "oauthAccessToken",
      "oauthRefreshToken",
      "oauthResource",
      "oauthClientResource",
      "oauthClientAssertion",
    ].map((model) => [model, []])
  );
  let failModel: string | undefined;
  let verificationToken = "";
  let providerName = "Private SSO Name";
  const memory = memoryAdapter(db);
  const auth = withNativeAuthAudit(
    betterAuth({
      baseURL,
      secret: "test-auth-audit-secret-01234567890123456789",
      database: withNativeAuthAuditAdapter(
        (options) =>
          new Proxy(memory(options), {
            get(target, property, receiver) {
              const method = Reflect.get(target, property, receiver);
              if (!["update", "delete", "deleteMany", "consumeOne"].includes(String(property))) return method;
              return new Proxy(method, {
                apply(fn, thisArg, args: unknown[]) {
                  if ((args[0] as { model: string }).model === failModel)
                    throw new Error("private database detail");
                  return Reflect.apply(fn, thisArg, args);
                },
              });
            },
          })
      ),
      emailAndPassword: { enabled: true, sendResetPassword: async () => {} },
      emailVerification: {
        sendVerificationEmail: async ({ token }) => {
          verificationToken = token;
        },
      },
      hooks: { before: createAuthMiddleware(captureTwoFactorAuditPrincipal) },
      plugins: [
        twoFactor(),
        jwt(),
        oauthProvider(getMcpOauthProviderOptions()),
        genericOAuth({
          config: [
            {
              providerId: "audit-idp",
              clientId: "test-client",
              clientSecret: "test-secret",
              authorizationUrl: "https://idp.example/authorize",
              overrideUserInfo: true,
              getToken: async () => ({ accessToken: "private-sso-token", scopes: ["profile", "email"] }),
              getUserInfo: async () => ({
                id: "sso-subject",
                email: "sso@example.com",
                name: providerName,
                emailVerified: true,
              }),
            },
          ],
        }),
      ],
    })
  );
  return {
    auth,
    db,
    verification: () => verificationToken,
    renameProviderUser: (name: string) => {
      providerName = name;
    },
    fail: (model?: string) => {
      failModel = model;
    },
  };
};

const signIn = async (auth: ReturnType<typeof setup>["auth"]) => {
  await auth.api.signUpEmail({ body: { email: "audit@example.com", password, name: "Private Name" } });
  const result = await auth.api.signInEmail({
    body: { email: "audit@example.com", password },
    asResponse: true,
  });
  const headers = new Headers({
    cookie: result.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; "),
  });
  vi.mocked(logger.audit).mockClear();
  return headers;
};
const events = () =>
  vi.mocked(logger.audit).mock.calls.map(([event]) => event as unknown as Record<string, unknown>);

beforeEach(() => {
  vi.clearAllMocks();
  settings.enabled = true;
});

describe("native auth entry points emit final Enterprise payloads", () => {
  test("profile update records principal, committed resource, safe fields and correlation; replay is a no-op", async () => {
    const { auth, db } = setup();
    const headers = await signIn(auth);
    await auth.api.updateUser({ headers, body: { name: "Another Private Name" } });
    expect(db.user[0].name).toBe("Another Private Name");
    expect(events()).toEqual([
      expect.objectContaining({
        actor: { id: db.user[0].id, type: "user" },
        target: { id: db.user[0].id, type: "user" },
        scope: "global",
        organizationId: "global",
        source: "native-auth",
        requestId: expect.any(String),
        status: "success",
        changes: expect.objectContaining({
          operation: "update-user",
          resources: [expect.objectContaining({ model: "user", fields: ["name"] })],
        }),
      }),
    ]);
    expect(JSON.stringify(events())).not.toMatch(/Private Name|audit@example|Never-log/);
    await auth.api.updateUser({ headers, body: { name: "Another Private Name" } });
    expect(events().at(-1)?.status).toBe("noop");
  });

  test("HTTP unauthenticated and invalid-body denials are audited before native hooks", async () => {
    const { auth } = setup();
    const result = await auth.handler(
      new Request(`${baseURL}/api/auth/update-user`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "private" }),
      })
    );
    expect(result.status).toBe(401);
    expect(events()).toEqual([
      expect.objectContaining({ actor: { id: "unknown", type: "anonymous" }, status: "denied" }),
    ]);
  });

  test("failed mutation emits failure without claiming the requested change happened", async () => {
    const { auth, db, fail } = setup();
    const headers = await signIn(auth);
    fail("user");
    await expect(auth.api.updateUser({ headers, body: { name: "new name" } })).rejects.toThrow();
    expect(db.user[0].name).toBe("Private Name");
    expect(events()).toEqual([
      expect.objectContaining({ status: "failure", changes: expect.objectContaining({ resources: [] }) }),
    ]);
    expect(JSON.stringify(events())).not.toContain("private database detail");
  });

  test("sign-out uses the session actor and observes an internally swallowed deletion failure", async () => {
    const { auth, db, fail } = setup();
    const headers = await signIn(auth);
    fail("session");
    const result = await auth.api.signOut({ headers });
    expect(result.success).toBe(true); // Better Auth swallows delete errors.
    expect(db.session).toHaveLength(2); // sign-up + sign-in
    expect(events()).toEqual([
      expect.objectContaining({
        action: "userSignedOut",
        status: "failure",
        actor: { id: db.user[0].id, type: "user" },
      }),
    ]);
    fail();
    await auth.api.signOut({ headers });
    expect(events().at(-1)).toMatchObject({ action: "userSignedOut", status: "success" });
    await auth.api.signOut({ headers });
    expect(events().at(-1)?.status).toBe("noop");
  });

  test("consent deletion through the server API audits exact consent, and an unauthenticated attempt is denied", async () => {
    const { auth, db } = setup();
    const headers = await signIn(auth);
    db.oauthConsent.push({
      id: "consent-1",
      userId: db.user[0].id,
      clientId: "client-1",
      scopes: ["read"],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await auth.api.deleteOAuthConsent({ headers, body: { id: "consent-1" } });
    expect(db.oauthConsent).toHaveLength(0);
    expect(events().at(-1)).toMatchObject({
      status: "success",
      target: { type: "oauthConsent", id: "consent-1" },
    });
    await expect(
      auth.api.deleteOAuthConsent({ headers: new Headers(), body: { id: "consent-1" } })
    ).rejects.toThrow();
    expect(events().at(-1)?.status).toBe("denied");
  });

  test("email verification without a session records the actual change, replay and invalid token", async () => {
    const { auth, db, verification } = setup();
    await signIn(auth);
    await auth.api.sendVerificationEmail({ body: { email: "audit@example.com" } });
    expect(events().at(-1)).toMatchObject({ status: "success", changes: { requestAccepted: true } });
    await auth.api.verifyEmail({ query: { token: verification() } });
    expect(db.user[0].emailVerified).toBe(true);
    expect(events().at(-1)).toMatchObject({
      status: "success",
      actor: { type: "user", id: db.user[0].id },
      changes: {
        resources: [expect.objectContaining({ flags: { emailVerified: { before: false, after: true } } })],
      },
    });
    await auth.api.verifyEmail({ query: { token: verification() } });
    expect(events().at(-1)?.status).toBe("noop");
    await expect(auth.api.verifyEmail({ query: { token: "invalid-secret-token" } })).rejects.toThrow();
    expect(events().at(-1)?.status).toBe("denied");
    expect(JSON.stringify(events())).not.toContain(verification());
  });

  test("2FA enrollment, challenge denial, backup-code rotation and disable never expose factors", async () => {
    const { auth, db } = setup();
    const headers = await signIn(auth);
    const enrolled = await auth.api.enableTwoFactor({ headers, body: { password, method: "totp" } });
    if (enrolled.method !== "totp") throw new Error("expected TOTP enrollment");
    const secret = new URL(enrolled.totpURI).searchParams.get("secret")!;
    expect(events().at(-1)?.status).toBe("success");
    const verified = await auth.api.verifyTOTP({
      headers,
      body: { code: authenticator.generate(secret) },
      asResponse: true,
    });
    headers.set(
      "cookie",
      verified.headers
        .getSetCookie()
        .map((cookie) => cookie.split(";")[0])
        .join("; ")
    );
    expect(db.user[0].twoFactorEnabled).toBe(true);
    await auth.api.generateBackupCodes({ headers, body: { password } });
    expect(events().at(-1)?.status).toBe("success");
    const challenge = await auth.api.signInEmail({
      body: { email: "audit@example.com", password },
      asResponse: true,
    });
    const challengeHeaders = new Headers({
      cookie: challenge.headers
        .getSetCookie()
        .map((cookie) => cookie.split(";")[0])
        .join("; "),
    });
    await expect(
      auth.api.verifyTOTP({ headers: challengeHeaders, body: { code: "not-a-code" } })
    ).rejects.toThrow();
    expect(events().at(-1)).toMatchObject({
      status: "denied",
      actor: { type: "user", id: db.user[0].id },
      changes: { authenticationStage: "password" },
    });
    await auth.api.disableTwoFactor({ headers, body: { password } });
    expect(db.user[0].twoFactorEnabled).toBe(false);
    expect(events().at(-1)?.status).toBe("success");
    const serialized = JSON.stringify(events());
    for (const credential of [password, secret, ...enrolled.backupCodes])
      expect(serialized).not.toContain(credential);
  });

  test("password change and batch session revocation identify committed rows", async () => {
    const { auth, db } = setup();
    const headers = await signIn(auth);
    await auth.api.changePassword({
      headers,
      body: { currentPassword: password, newPassword: "Another-secret-password123!" },
    });
    expect(events().at(-1)).toMatchObject({
      status: "success",
      changes: { resources: [expect.objectContaining({ model: "account", fields: ["password"] })] },
    });
    const revokedId = db.session[0].id;
    await auth.api.revokeOtherSessions({ headers });
    expect(db.session).toHaveLength(1);
    expect(events().at(-1)).toMatchObject({
      status: "success",
      changes: {
        resources: [expect.objectContaining({ model: "session", id: revokedId, operation: "delete" })],
      },
    });
    await auth.api.revokeOtherSessions({ headers });
    expect(events().at(-1)?.status).toBe("noop");
  });

  test("a later 2FA write failure reports only the state already changed", async () => {
    const { auth, db, fail } = setup();
    const headers = await signIn(auth);
    await auth.api.enableTwoFactor({ headers, body: { password, method: "totp" } });
    db.user[0].twoFactorEnabled = true;
    vi.mocked(logger.audit).mockClear();
    fail("twoFactor");
    await expect(auth.api.disableTwoFactor({ headers, body: { password } })).rejects.toThrow();
    expect(db.user[0].twoFactorEnabled).toBe(false);
    expect(db.twoFactor).toHaveLength(1);
    expect(events()).toEqual([
      expect.objectContaining({
        status: "partial",
        changes: expect.objectContaining({
          resources: [
            expect.objectContaining({
              model: "user",
              fields: ["twoFactorEnabled"],
              flags: { twoFactorEnabled: { before: true, after: false } },
            }),
          ],
        }),
      }),
    ]);
  });

  test("batch revocation records every affected session beyond the adapter default page", async () => {
    const { auth, db } = setup();
    const headers = await signIn(auth);
    for (let index = 0; index < 105; index++)
      db.session.push({ ...db.session[0], id: `batch-${index}`, token: `secret-session-${index}` });
    const ids = db.session.map(({ id }) => id);
    await auth.api.revokeSessions({ headers });
    expect(db.session).toHaveLength(0);
    const resources = (events().at(-1)?.changes as { resources: { id: string }[] }).resources;
    expect(resources.map(({ id }) => id).sort()).toEqual(ids.sort());
    expect(events().at(-1)?.status).toBe("success");
    expect(JSON.stringify(events())).not.toContain("secret-session-");
  });

  test("SSO callbacks audit automatic existing-user name changes but suppress unchanged profiles and creation", async () => {
    const { auth, db, renameProviderUser } = setup();
    const callback = async () => {
      const start = await auth.api.signInSocial({
        body: { provider: "audit-idp", callbackURL: `${baseURL}/account` },
        asResponse: true,
      });
      const { url } = await start.json();
      const state = new URL(url).searchParams.get("state")!;
      const response = await auth.handler(
        new Request(
          `${baseURL}/api/auth/callback/audit-idp?${new URLSearchParams({ state, code: "private-code" })}`,
          {
            headers: {
              cookie: start.headers
                .getSetCookie()
                .map((cookie) => cookie.split(";")[0])
                .join("; "),
            },
          }
        )
      );
      expect(response.headers.get("location")).toBe(`${baseURL}/account`);
    };
    await callback();
    expect(db.user).toHaveLength(1);
    expect(events()).toEqual([]); // User creation belongs to ENG-2347.
    renameProviderUser("Changed Private SSO Name");
    await callback();
    expect(db.user[0].name).toBe("Changed Private SSO Name");
    expect(events()).toEqual([
      expect.objectContaining({
        actor: { id: "sso", type: "system" },
        target: { id: db.user[0].id, type: "user" },
        status: "success",
        changes: expect.objectContaining({
          operation: "sso_callback",
          resources: [expect.objectContaining({ fields: ["name"] })],
        }),
      }),
    ]);
    expect(JSON.stringify(events())).not.toMatch(/Private SSO|sso@example|private-code|private-sso-token/);
    await callback();
    expect(events()).toHaveLength(1);
  });

  test("SSO callback failures are Enterprise denials without query credentials", async () => {
    const { auth } = setup();
    const response = await auth.handler(
      new Request(`${baseURL}/api/auth/callback/missing?code=private-code&state=private-state`)
    );
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(events().at(-1)).toMatchObject({ status: "denied", changes: { operation: "sso_callback" } });
    expect(JSON.stringify(events())).not.toMatch(/private-code|private-state/);
  });

  test("OAuth registration, consent, token issuance, refresh and revocation emit exact safe resources", async () => {
    const { auth, db } = setup();
    const headers = await signIn(auth);
    const redirectUri = "http://127.0.0.1:33418/callback";
    const registered = await auth.api.registerOAuthClient({
      body: {
        redirect_uris: [redirectUri],
        application_type: "native",
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        scope: "surveys:read offline_access",
      },
    });
    const clientId = registered.client_id;
    expect(events().at(-1)).toMatchObject({
      status: "success",
      target: { type: "oauthClient", id: db.oauthClient[0].id },
    });
    const verifier = "a".repeat(64);
    const query = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: "surveys:read offline_access",
      state: "private-state",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      resource: `${baseURL}/api/mcp`,
    });
    const authorize = await auth.handler(
      new Request(`${baseURL}/api/auth/oauth2/authorize?${query}`, { headers })
    );
    expect(authorize.status).toBe(302);
    const consentLocation = new URL(authorize.headers.get("location")!, baseURL);
    const sendConsent = (accept: boolean) =>
      auth.handler(
        new Request(`${baseURL}/api/auth/oauth2/consent`, {
          method: "POST",
          headers: new Headers({ cookie: headers.get("cookie")!, "content-type": "application/json" }),
          body: JSON.stringify({ accept, oauth_query: consentLocation.search.slice(1) }),
        })
      );
    const denied = await sendConsent(false);
    expect(denied).toBeDefined();
    expect(events().at(-1)?.status).toBe("denied");
    const consentResponse = await sendConsent(true);
    const consent = await consentResponse.json();
    expect(events().at(-1)).toMatchObject({
      status: "success",
      target: { type: "oauthConsent", id: db.oauthConsent[0].id },
    });
    const redirect = "url" in consent ? consent.url : undefined;
    expect(redirect).toBeTruthy();
    const code = new URL(redirect!).searchParams.get("code")!;
    const tokenResponse = await auth.handler(
      new Request(`${baseURL}/api/auth/oauth2/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
          resource: `${baseURL}/api/mcp`,
        }),
      })
    );
    expect(tokenResponse.status, await tokenResponse.clone().text()).toBe(200);
    const tokens = await tokenResponse.json();
    expect(tokens.refresh_token).toBeTruthy();
    expect(events().at(-1)).toMatchObject({
      status: "success",
      actor: { type: "oauthClient", id: clientId },
    });
    const refreshResponse = await auth.handler(
      new Request(`${baseURL}/api/auth/oauth2/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          refresh_token: tokens.refresh_token,
          resource: `${baseURL}/api/mcp`,
        }),
      })
    );
    expect(refreshResponse.status).toBe(200);
    const refreshed = await refreshResponse.json();
    expect(events().at(-1)?.status).toBe("success");
    const revoke = await auth.handler(
      new Request(`${baseURL}/api/auth/oauth2/revoke`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          token: refreshed.refresh_token,
          token_type_hint: "refresh_token",
        }),
      })
    );
    expect(revoke.status).toBe(200);
    expect(events().at(-1)).toMatchObject({
      status: "success",
      actor: { type: "oauthClient", id: clientId },
      changes: {
        resources: expect.arrayContaining([
          expect.objectContaining({ model: "oauthRefreshToken", operation: "update", fields: ["revoked"] }),
        ]),
      },
    });
    const invalidLogout = await auth.handler(
      new Request(`${baseURL}/api/auth/oauth2/end-session/confirm`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "action=confirm",
      })
    );
    expect(invalidLogout.status).toBeGreaterThanOrEqual(400);
    expect(events().at(-1)).toMatchObject({
      status: "denied",
      changes: { operation: "oauth2/end-session/confirm" },
    });
    for (const credential of [
      tokens.access_token,
      tokens.refresh_token,
      refreshed.access_token,
      refreshed.refresh_token,
      code,
      verifier,
      "private-state",
    ])
      expect(JSON.stringify(events())).not.toContain(credential);
  });

  test("disabled auditing leaves mutations intact and sink failure cannot alter a completed operation", async () => {
    const { auth, db } = setup();
    const headers = await signIn(auth);
    settings.enabled = false;
    await auth.api.updateUser({ headers, body: { name: "Disabled" } });
    expect(db.user[0].name).toBe("Disabled");
    expect(events()).toEqual([]);
    settings.enabled = true;
    vi.mocked(logger.audit).mockImplementation(() => {
      throw new Error("sink failed");
    });
    vi.mocked(logger.error).mockImplementation(() => {
      throw new Error("error sink also failed");
    });
    await expect(auth.api.updateUser({ headers, body: { name: "Still succeeds" } })).resolves.toMatchObject({
      status: true,
    });
    expect(db.user[0].name).toBe("Still succeeds");
  });
});
