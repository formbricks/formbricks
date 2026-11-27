import { generateSync } from "otplib";
import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { runWithSsoRequestContext } from "@/modules/ee/sso/lib/sso-request-context";

/**
 * Better Auth's native HTTP surface, pinned (ADR 0017, ENG-7268).
 *
 * `app/api/auth/[...all]/route.ts` mounts `auth.handler` raw, so every endpoint Better Auth or one of its
 * plugins declares is public the day we install or upgrade it. Our own flows (server actions) call
 * `auth.api.*` in-process, where `disabledPaths` does not apply, so a route we do not use over HTTP is
 * closed in `auth.ts` instead of left beside the stricter flow it undercuts.
 *
 * `SERVED_OVER_HTTP` is the one list of what may stay open. A path Better Auth declares that is neither
 * closed in `disabledPaths` nor listed here fails the first test, so a route added by an upgrade or a new
 * plugin is a decision someone makes in this file, not a default. A path may sit in both places (closed
 * AND listed): the list says "allowed to be served", not "is served".
 */
const SERVED_OVER_HTTP: Record<string, string> = {
  // Called by the browser from our own screens (login form, sign-out, SSO buttons, account deletion,
  // MCP consent) or reached by following a link we emailed or an identity provider redirect.
  "/sign-in/email": "login form (authClient.signIn.email)",
  "/sign-in/social": "SSO buttons (authClient.signIn.social)",
  "/sign-out": "sign-out (authClient.signOut)",
  "/get-session": "useSession() and the forward-auth proxy",
  "/two-factor/verify-totp": "login form second step (authClient.twoFactor.verifyTotp)",
  "/two-factor/verify-backup-code": "login form second step (authClient.twoFactor.verifyBackupCode)",
  "/delete-user": "account deletion (authClient.deleteUser), gated in hooks.before + 5/hour",
  "/delete-user/callback": "emailed account-deletion link",
  "/verify-email": "emailed verification link",
  "/reset-password": "password-reset form",
  "/reset-password/:token": "emailed password-reset link",
  "/callback/:id": "identity provider redirect",
  "/error": "Better Auth's error redirect target",
  "/ok": "health probe",
  "/sso-recovery/sign-in": "emailed SSO-recovery link",
  // The MCP OAuth authorization server (oauthProvider + jwt plugins). Its own gates live in the hooks
  // and options under modules/auth/lib (mcp-oauth-provider-options.ts, oauth-grant-revocation.ts,
  // dashboard-viewer-oauth-consent.ts); this list does not re-review them.
  "/.well-known/oauth-authorization-server": "MCP OAuth discovery",
  "/.well-known/openid-configuration": "MCP OAuth discovery",
  "/jwks": "MCP OAuth signing keys",
  "/oauth2/authorize": "MCP OAuth",
  "/oauth2/consent": "MCP OAuth consent page (authClient.oauth2.consent)",
  "/oauth2/continue": "MCP OAuth",
  "/oauth2/end-session": "MCP OAuth",
  "/oauth2/end-session/confirm": "MCP OAuth",
  "/oauth2/introspect": "MCP OAuth",
  "/oauth2/public-client": "MCP OAuth",
  "/oauth2/public-client-prelogin": "MCP OAuth",
  "/oauth2/register": "MCP OAuth dynamic client registration",
  "/oauth2/revoke": "MCP OAuth",
  "/oauth2/token": "MCP OAuth",
  "/oauth2/userinfo": "MCP OAuth",
  "/oauth2/get-consent": "MCP OAuth consent management",
  "/oauth2/get-consents": "MCP OAuth consent management",
  "/oauth2/update-consent": "MCP OAuth consent management",
  "/oauth2/delete-consent": "MCP OAuth consent management",
  "/oauth2/get-client": "MCP OAuth client management",
  "/oauth2/get-clients": "MCP OAuth client management",
  // Registration is `/oauth2/register` only, behind the redirect allowlist (ENG-3086, ENG-3471).
  // `/oauth2/create-client`, `/oauth2/update-client`, `/oauth2/delete-client` and
  // `/oauth2/client/rotate-secret` are closed in `disabledPaths` (ENG-3253): no screen calls them and
  // they skip that allowlist for any signed-in user.
  "/admin/oauth2/create-client": "MCP OAuth admin",
  "/admin/oauth2/update-client": "MCP OAuth admin",
  "/admin/oauth2/resources": "MCP OAuth admin",
  "/admin/oauth2/resources/:identifier": "MCP OAuth admin",
  "/admin/oauth2/resources/:identifier/clients/:client_id": "MCP OAuth admin",
  // Self-service reads and session housekeeping on the caller's own rows. No Formbricks policy sits
  // beside them (no password, second factor or audit rule to bypass), so they stay.
  "/list-accounts": "caller's own linked accounts",
  "/list-sessions": "caller's own sessions",
  "/revoke-session": "caller's own session",
  "/revoke-sessions": "caller's own sessions",
  "/revoke-other-sessions": "caller's own sessions",
  "/update-session": "caller's own session",
  "/account-info": "caller's own account",
  "/get-access-token": "caller's own provider token",
  "/refresh-token": "caller's own provider token",
};

const ORIGIN = "http://localhost:3000";
const PASSWORD = "Passw0rd!";
const EMAIL = "native-endpoints@example.com";

const declaredPaths = (): string[] =>
  Object.values(auth.api).flatMap((endpoint) => (typeof endpoint?.path === "string" ? [endpoint.path] : []));

const closedPaths = (): string[] => auth.options.disabledPaths ?? [];

const cookiesOf = (res: Response): string =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

const secretFromUri = (uri: string): string => /[?&]secret=([^&]+)/.exec(uri)?.[1] ?? "";
const totp = (secret: string): string => generateSync({ secret });

const rawPost = (path: string, cookie: string, body: Record<string, unknown> = {}): Promise<Response> =>
  runWithSsoRequestContext(() =>
    auth.handler(
      new Request(`${ORIGIN}/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN, cookie },
        body: JSON.stringify(body),
      })
    )
  );

/** A verified user with TOTP enabled and a fresh signed-in session: the state a stolen cookie gives. */
const userWithTwoFactor = async (): Promise<{ cookie: string; secret: string; backupCodes: string[] }> => {
  await auth.api.signUpEmail({
    body: { email: EMAIL, password: PASSWORD, name: "Native" },
    asResponse: true,
  });
  await prisma.user.update({ where: { email: EMAIL }, data: { emailVerified: true } });
  const signedIn = await auth.api.signInEmail({
    body: { email: EMAIL, password: PASSWORD },
    asResponse: true,
  });
  const cookie = cookiesOf(signedIn);
  const enrolled = await auth.api.enableTwoFactor({ body: { password: PASSWORD }, headers: { cookie } });
  if (enrolled.method !== "totp") throw new Error(`expected a TOTP enrolment, got "${enrolled.method}"`);
  const secret = secretFromUri(enrolled.totpURI);
  const verified = await auth.api.verifyTOTP({
    body: { code: totp(secret) },
    headers: { cookie },
    asResponse: true,
  });
  // Verifying the first code swaps the session; the new cookie is the one a thief would hold.
  return { cookie: cookiesOf(verified) || cookie, secret, backupCodes: enrolled.backupCodes };
};

beforeEach(async () => {
  await resetDb();
});

describe("Better Auth native endpoints", () => {
  test("every route Better Auth declares is closed in disabledPaths or on the allow-list", () => {
    const closed = new Set(closedPaths());
    const unreviewed = declaredPaths().filter((path) => !closed.has(path) && !(path in SERVED_OVER_HTTP));

    // A failure here means an upgrade or plugin added a native route. Decide: close it in auth.ts
    // `disabledPaths` (the default when our own action or hook already owns the behaviour), or list it
    // above with the reason it may stay public.
    expect(unreviewed.sort()).toEqual([]);
  });

  test("the allow-list names only routes Better Auth still declares", () => {
    const declared = new Set(declaredPaths());
    const stale = Object.keys(SERVED_OVER_HTTP).filter((path) => !declared.has(path));

    expect(stale).toEqual([]);
  });

  test("every closed route is one Better Auth really declares", () => {
    // A mistyped or stale `disabledPaths` entry would also answer 404, and close nothing.
    const declared = new Set(declaredPaths());

    expect(closedPaths().filter((path) => !declared.has(path))).toEqual([]);
  });

  test("a closed route is never also a route our own client calls", () => {
    // The client reaches these over HTTP; closing one would break sign-in or deletion for everyone.
    const callsOverHttp = [
      "/sign-in/email",
      "/sign-in/social",
      "/sign-out",
      "/get-session",
      "/two-factor/verify-totp",
      "/two-factor/verify-backup-code",
      "/delete-user",
      "/oauth2/consent",
    ];

    expect(closedPaths().filter((path) => callsOverHttp.includes(path))).toEqual([]);
  });

  test("the routes that undercut the app's own flows answer 404 even with a live session", async () => {
    const { cookie } = await userWithTwoFactor();
    const mustBeClosed = [
      "/verify-password",
      "/change-password",
      "/change-email",
      "/two-factor/enable",
      "/two-factor/disable",
      "/two-factor/generate-backup-codes",
      "/two-factor/get-totp-uri",
      "/two-factor/send-otp",
      "/two-factor/verify-otp",
      "/link-social",
      "/unlink-account",
      "/oauth2/create-client",
      "/oauth2/update-client",
      "/oauth2/delete-client",
      "/oauth2/client/rotate-secret",
    ];

    // One at a time: before the fix several of these mutate the same user and race each other.
    const statuses: [string, number][] = [];
    for (const path of mustBeClosed) {
      statuses.push([path, (await rawPost(path, cookie, { password: PASSWORD })).status]);
    }

    expect(Object.fromEntries(statuses)).toEqual(Object.fromEntries(mustBeClosed.map((path) => [path, 404])));
  });

  test("a signed-in user cannot register an OAuth client with their own redirect URI", async () => {
    const { cookie } = await userWithTwoFactor();

    const created = await rawPost("/oauth2/create-client", cookie, {
      client_name: "Claude",
      redirect_uris: ["https://attacker.example.org/cb"],
    });

    // Before the fix: 201 with a client_id for the attacker's redirect, past the DCR allowlist.
    expect(created.status).toBe(404);
    // Near-miss spellings must not route to the handler either.
    const body = { client_name: "Claude", redirect_uris: ["https://attacker.example.org/cb"] };
    expect((await rawPost("/oauth2/create-client/", cookie, body)).status).toBe(404);
    expect((await rawPost("//oauth2/create-client", cookie, body)).status).toBe(404);
    expect(closedPaths()).toEqual(
      expect.arrayContaining([
        "/oauth2/create-client",
        "/oauth2/update-client",
        "/oauth2/delete-client",
        "/oauth2/client/rotate-secret",
      ])
    );
    expect(await prisma.oauthClient.count()).toBe(0);
  });

  test("a session and the password alone cannot switch 2FA off or mint backup codes over HTTP", async () => {
    const { cookie } = await userWithTwoFactor();

    const disable = await rawPost("/two-factor/disable", cookie, { password: PASSWORD });
    const codes = await rawPost("/two-factor/generate-backup-codes", cookie, { password: PASSWORD });

    // Before the fix: 200 and `twoFactorEnabled` false, with no TOTP or backup code asked for.
    expect(disable.status).toBe(404);
    expect(codes.status).toBe(404);
    expect((await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } })).twoFactorEnabled).toBe(true);
  });

  test("the login form's second step still works over HTTP: TOTP and backup code", async () => {
    const { secret, backupCodes } = await userWithTwoFactor();
    const challenge = async (): Promise<string> =>
      cookiesOf(await auth.api.signInEmail({ body: { email: EMAIL, password: PASSWORD }, asResponse: true }));

    const withTotp = await rawPost("/two-factor/verify-totp", await challenge(), { code: totp(secret) });
    const withBackup = await rawPost("/two-factor/verify-backup-code", await challenge(), {
      code: backupCodes[0],
    });

    expect(withTotp.status).toBe(200);
    expect(withBackup.status).toBe(200);
  });
});
