import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { IdentityProvider } from "@formbricks/database/prisma";
import { POST } from "@/app/api/auth/[...all]/route";
import { flushAfter } from "@/integration/after";
import { callRoute } from "@/integration/api-routes";
import { resetDb } from "@/integration/reset-db";
import { hashSecret } from "@/lib/crypto";
import { logAuthAttempt } from "@/modules/auth/lib/utils";
import { getIsSamlSsoEnabled, getIsSsoEnabled } from "@/modules/ee/license-check/lib/utils";

/**
 * ENG-2590 through the real `POST /api/auth/sign-in/email`: Better Auth, Postgres, the session database
 * hook. An account linked to SSO signs in with SSO while this instance offers one of its providers, and with
 * its password when it offers none. Only the licence is stubbed: there is none in this environment.
 */

const SIGN_IN = "/api/auth/sign-in/email";
const PASSWORD = "Sso-Linked-Password-1";

// Pinned rather than inherited from `.env`: `requireEmailVerification` is read at import time, and which
// providers count as configured decides every case below. Every provider is pinned, GitHub off so one
// test has a provider that is licensed but not configured; CI's `.env` configures none of SAML or OIDC.
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  EMAIL_AUTH_ENABLED: true,
  EMAIL_VERIFICATION_DISABLED: false,
  GOOGLE_OAUTH_ENABLED: true,
  AZURE_OAUTH_ENABLED: true,
  OIDC_OAUTH_ENABLED: true,
  SAML_OAUTH_ENABLED: true,
  GITHUB_OAUTH_ENABLED: false,
}));

vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsSsoEnabled: vi.fn(async () => true),
  getIsSamlSsoEnabled: vi.fn(async () => true),
}));

// Spied so a test can read the reason the failed-sign-in audit records.
vi.mock("@/modules/auth/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/auth/lib/utils")>();
  return { ...actual, logAuthAttempt: vi.fn(actual.logAuthAttempt) };
});

// Holds `after()` work until `flushAfter()`.
vi.mock("next/server", async (importOriginal) =>
  (await import("@/integration/after")).withAfterMock(await importOriginal())
);

const postSignIn = (email: string, password = PASSWORD) =>
  callRoute(POST, { method: "POST", path: SIGN_IN, body: { email, password } });

/** A user with a password on a credential account, plus SSO account rows for `ssoProviders`. */
const seedUser = async ({
  email,
  identityProvider,
  ssoProviders = [],
  emailVerified = true,
  isActive = true,
  twoFactorEnabled = false,
}: {
  email: string;
  identityProvider: IdentityProvider;
  ssoProviders?: string[];
  emailVerified?: boolean;
  isActive?: boolean;
  twoFactorEnabled?: boolean;
}) => {
  const user = await prisma.user.create({
    data: {
      name: "Linked User",
      email,
      emailVerified,
      isActive,
      twoFactorEnabled,
      locale: "en-US",
      identityProvider,
    },
  });
  if (twoFactorEnabled) {
    // The sign-in step only reads the flag; the challenge, which reads the secret, is never reached here.
    await prisma.twoFactor.create({ data: { userId: user.id, secret: "unused", backupCodes: "unused" } });
  }
  await prisma.account.create({
    data: {
      userId: user.id,
      type: "credential",
      provider: "credential",
      providerAccountId: user.id,
      password: await hashSecret(PASSWORD, 4),
    },
  });
  for (const provider of ssoProviders) {
    await prisma.account.create({
      data: { userId: user.id, type: "oauth", provider, providerAccountId: `${provider}-${user.id}` },
    });
  }
  return user;
};

const sessionCount = (userId: string) => prisma.session.count({ where: { userId } });

beforeEach(async () => {
  await resetDb();
  await flushAfter();
  vi.mocked(getIsSsoEnabled).mockResolvedValue(true);
  vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);
  vi.mocked(logAuthAttempt).mockClear();
});

describe("password sign-in for an account linked to SSO", () => {
  test("case 1: refused while its provider is offered, naming the provider, with no session", async () => {
    const user = await seedUser({
      email: "linked@example.com",
      identityProvider: "google",
      ssoProviders: ["google"],
    });

    const response = await postSignIn("linked@example.com");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      code: "SSO_SIGN_IN_REQUIRED",
      message: "Your account uses single sign-on. Sign in with Google.",
      providerNames: ["Google"],
    });
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(await sessionCount(user.id)).toBe(0);
    // The audit trail records why, like every other refused password sign-in.
    expect(logAuthAttempt).toHaveBeenCalledWith(
      "sso_sign_in_required",
      "credentials",
      "password",
      expect.anything(),
      "linked@example.com"
    );
  });

  test("case 2: allowed while the licence is lapsed, and refused again once it is back (case 3)", async () => {
    const user = await seedUser({
      email: "linked@example.com",
      identityProvider: "google",
      ssoProviders: ["google"],
    });
    vi.mocked(getIsSsoEnabled).mockResolvedValue(false);

    const allowed = await postSignIn("linked@example.com");

    expect(allowed.status).toBe(200);
    expect(allowed.headers.getSetCookie().some((cookie) => cookie.includes("session_token"))).toBe(true);
    expect(await sessionCount(user.id)).toBe(1);

    vi.mocked(getIsSsoEnabled).mockResolvedValue(true);

    const refusedAgain = await postSignIn("linked@example.com");

    expect(refusedAgain.status).toBe(403);
    expect(await sessionCount(user.id)).toBe(1);
  });

  test("case 2: allowed when its provider is no longer configured on this instance", async () => {
    // GitHub is licensed but not configured here (GITHUB_OAUTH_ENABLED is false).
    await seedUser({ email: "linked@example.com", identityProvider: "github", ssoProviders: ["github"] });

    expect((await postSignIn("linked@example.com")).status).toBe(200);
  });

  test("a SAML account is refused while SAML is licensed, and allowed once its licence is missing", async () => {
    await seedUser({ email: "linked@example.com", identityProvider: "saml", ssoProviders: ["saml"] });

    const refused = await postSignIn("linked@example.com");
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ providerNames: ["SAML SSO"] });

    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(false);

    expect((await postSignIn("linked@example.com")).status).toBe(200);
  });

  test("an account with two-factor is refused before any challenge is issued", async () => {
    await seedUser({
      email: "linked@example.com",
      identityProvider: "google",
      ssoProviders: ["google"],
      twoFactorEnabled: true,
    });

    const refused = await postSignIn("linked@example.com");

    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ code: "SSO_SIGN_IN_REQUIRED" });
    expect(refused.headers.getSetCookie()).toEqual([]);

    // The control: with SSO unavailable the same account reaches the two-factor challenge, so the
    // refusal above is the gate and not a broken two-factor seed.
    vi.mocked(getIsSsoEnabled).mockResolvedValue(false);
    const challenged = await postSignIn("linked@example.com");

    expect(challenged.status).toBe(200);
    expect(challenged.body).toMatchObject({ twoFactorRedirect: true });
    expect(challenged.headers.getSetCookie().some((cookie) => cookie.includes("two_factor"))).toBe(true);
  });

  test("names only the linked providers this instance offers", async () => {
    await seedUser({
      email: "linked@example.com",
      identityProvider: "github",
      ssoProviders: ["github", "azuread"],
    });

    const response = await postSignIn("linked@example.com");

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ providerNames: ["Microsoft"] });
  });

  test("case 4: a password user signs in as before, even with a stray SSO account row", async () => {
    const user = await seedUser({
      email: "password@example.com",
      identityProvider: "email",
      ssoProviders: ["google"],
    });

    const response = await postSignIn("password@example.com");

    expect(response.status).toBe(200);
    expect(await sessionCount(user.id)).toBe(1);
  });

  test("a deactivated account is told it is inactive, not pointed at SSO", async () => {
    await seedUser({
      email: "linked@example.com",
      identityProvider: "google",
      ssoProviders: ["google"],
      isActive: false,
    });

    const response = await postSignIn("linked@example.com");

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      message: "Your account is currently inactive. Please contact the organization admin.",
    });
  });
});

describe("only a caller who knows the password learns the account uses SSO", () => {
  test("a wrong password, an unverified account and an unknown address all answer as before", async () => {
    await seedUser({ email: "linked@example.com", identityProvider: "google", ssoProviders: ["google"] });
    await seedUser({
      email: "unverified@example.com",
      identityProvider: "google",
      ssoProviders: ["google"],
      emailVerified: false,
    });

    const unknown = await postSignIn("nobody@example.com");
    const answers = {
      wrongPassword: await postSignIn("linked@example.com", "Wrong-Password-1"),
      unverifiedWithRightPassword: await postSignIn("unverified@example.com"),
    };

    expect(unknown.status).toBe(401);
    for (const [mode, answer] of Object.entries(answers)) {
      expect(answer.status, mode).toBe(unknown.status);
      expect(answer.body, mode).toEqual(unknown.body);
      expect(answer.headers.getSetCookie(), mode).toEqual([]);
    }
  });
});
