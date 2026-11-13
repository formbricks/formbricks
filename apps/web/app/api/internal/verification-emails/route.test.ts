import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SSO_RECOVERY_LINK_EXPIRED_ERROR_CODE, TooManyRequestsError } from "@formbricks/types/errors";
import { PRE_LOGIN_BODY_LIMIT_BYTES } from "@/app/api/internal/lib/limits";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { MAX_CALLBACK_URL_LENGTH } from "@/lib/utils/url";
import { auth } from "@/modules/auth/lib/auth";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { applyIPRateLimit, applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { sendVerificationEmail } from "@/modules/email";
import { POST } from "./route";

vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyIPRateLimit: vi.fn(), applyRateLimit: vi.fn() }));
vi.mock("@/modules/auth/lib/user", () => ({ getUserByEmail: vi.fn() }));
vi.mock("@/modules/email", () => ({ sendVerificationEmail: vi.fn() }));
// Email verification resends go through Better Auth's native endpoint (ENG-1054).
vi.mock("@/modules/auth/lib/auth", () => ({ auth: { api: { sendVerificationEmail: vi.fn() } } }));

const cookieMocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
  cookies: vi.fn(() => Promise.resolve(cookieMocks)),
}));

// The intent-cookie refresh (ENG-2562): classify/mint are unit-tested in signup-intent.test.ts; here
// only the route's decision — refresh iff the browser already proves this user — is under test.
const signupIntentMocks = vi.hoisted(() => ({
  classifySignupIntent: vi.fn(),
  createSignupIntentToken: vi.fn(),
}));

const recoveryIntentMocks = vi.hoisted(() => ({
  readSsoRecoveryIntent: vi.fn(),
  refreshSsoRecoveryIntent: vi.fn(),
  getSsoRecoveryPairedTtlSeconds: vi.fn(() => 60 * 15),
}));

vi.mock("@/modules/auth/lib/signup-intent", () => ({
  SIGNUP_INTENT_COOKIE_NAME: "formbricks.signup_intent",
  SIGNUP_INTENT_COOKIE_OPTIONS: { httpOnly: true, secure: false, path: "/", sameSite: "lax", maxAge: 3600 },
  classifySignupIntent: signupIntentMocks.classifySignupIntent,
  createSignupIntentToken: signupIntentMocks.createSignupIntentToken,
}));

vi.mock("@/modules/ee/sso/lib/recovery-intent", () => ({
  readSsoRecoveryIntent: recoveryIntentMocks.readSsoRecoveryIntent,
  refreshSsoRecoveryIntent: recoveryIntentMocks.refreshSsoRecoveryIntent,
  getSsoRecoveryPairedTtlSeconds: recoveryIntentMocks.getSsoRecoveryPairedTtlSeconds,
}));

vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  WEBAPP_URL: "http://localhost:3000",
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: vi.fn() }));
vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock("server-only", () => ({}));

const validInput = { email: "test@example.com" };
const mockUser = { id: "user123", email: "test@example.com", locale: "en-US", emailVerified: false };
const mockVerifiedUser = {
  id: "user123",
  email: "test@example.com",
  emailVerified: true, // boolean post-cutover (ENG-1054); keep fixtures off the legacy Date contract
  name: "Test User",
  locale: "en-US",
  identityProvider: "email",
  isActive: true,
};
const RECOVERY_CALLBACK = "http://localhost:3000/api/auth/sso/recovery/complete?state=test-state";
const liveIntent = (email = mockVerifiedUser.email) => ({
  callbackUrl: "http://localhost:3000",
  email,
  provider: "google",
  providerAccountId: "provider_123",
  userId: mockVerifiedUser.id,
  createdAt: Date.now(),
});

const resend = (body: unknown = validInput, extraHeaders: Record<string, string> = SAME_ORIGIN_HEADERS) =>
  POST(
    new NextRequest("http://localhost/api/internal/verification-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    {} as never
  );

const auditEvents = () => vi.mocked(queueAuditEvent).mock.calls.map(([event]) => event);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true } as never);
  vi.mocked(queueAuditEvent).mockResolvedValue(undefined);
  vi.mocked(getUserByEmail).mockResolvedValue(mockUser as never);
  // Default: no stored intent, so a client-supplied recovery callback proves nothing on its own.
  recoveryIntentMocks.readSsoRecoveryIntent.mockResolvedValue(null);
  recoveryIntentMocks.getSsoRecoveryPairedTtlSeconds.mockReturnValue(60 * 15);
  cookieMocks.get.mockReturnValue(undefined);
  signupIntentMocks.classifySignupIntent.mockReturnValue("absent");
  signupIntentMocks.createSignupIntentToken.mockReturnValue("fresh-intent-token");
});

describe("POST /api/internal/verification-emails — rate limiting", () => {
  test("spends the client IP's budget, with its config, before looking the address up", async () => {
    await resend();

    expect(applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.verifyEmail);
    expect(applyIPRateLimit).toHaveBeenCalledBefore(vi.mocked(getUserByEmail));
  });

  test("answers 429, looks nothing up and audits nothing when the IP budget is spent", async () => {
    vi.mocked(applyIPRateLimit).mockRejectedValue(
      new TooManyRequestsError("Maximum number of requests reached. Please try again later.", 60)
    );

    const response = await resend();

    expect(response.status).toBe(429);
    expect((await response.json()).detail).toBe(
      "Maximum number of requests reached. Please try again later."
    );
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
    expect(queueAuditEvent).not.toHaveBeenCalled();
  });

  // Anyone can ask for an account's verification email, so it is counted per account too: strangers on
  // many IPs must not spend the recipient's whole cap and leave the user's own resend with none (ENG-3823).
  test("counts each resend against the account", async () => {
    await resend();

    expect(applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.verifyEmailPerAccount, mockUser.id);
  });

  test("sends nothing, and fails, when the per-account limiter itself fails", async () => {
    vi.mocked(applyRateLimit).mockRejectedValue(new Error("redis down"));

    expect((await resend()).status).toBe(500);
    expect(auth.api.sendVerificationEmail).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  // A spent cap must look like a sent email: only unverified accounts reach it, so an error here would
  // tell anyone which addresses have one (ENG-3823).
  test("answers 204 once the account's resends are spent, so it reveals nothing", async () => {
    vi.mocked(applyRateLimit).mockRejectedValue(
      new TooManyRequestsError("Maximum number of requests reached")
    );

    expect((await resend()).status).toBe(204);
    expect(auth.api.sendVerificationEmail).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  test("spends the IP budget even when the user doesn't exist", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null);

    expect((await resend()).status).toBe(422);
    expect(applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.verifyEmail);
  });
});

describe("POST /api/internal/verification-emails — resend flow", () => {
  test("sends the verification email through Better Auth when the address is not yet verified", async () => {
    const response = await resend();

    expect(response.status).toBe(204);
    expect(getUserByEmail).toHaveBeenCalledWith(validInput.email);
    expect(auth.api.sendVerificationEmail).toHaveBeenCalledWith({
      body: { email: mockUser.email, callbackURL: undefined },
      headers: expect.any(Headers),
    });
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  test("preserves a valid callback URL", async () => {
    await resend({ ...validInput, callbackUrl: "http://localhost:3000/invite?token=invite-token" });

    expect(auth.api.sendVerificationEmail).toHaveBeenCalledWith({
      body: { email: mockUser.email, callbackURL: "http://localhost:3000/invite?token=invite-token" },
      headers: expect.any(Headers),
    });
  });

  test("discards an invalid callback URL", async () => {
    await resend({ ...validInput, callbackUrl: "https://evil.example/phish" });

    expect(auth.api.sendVerificationEmail).toHaveBeenCalledWith({
      body: { email: mockUser.email, callbackURL: undefined },
      headers: expect.any(Headers),
    });
  });

  test("answers 204 without sending when the address is already verified", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(mockVerifiedUser as never);

    expect((await resend()).status).toBe(204);
    expect(sendVerificationEmail).not.toHaveBeenCalled();
    expect(auth.api.sendVerificationEmail).not.toHaveBeenCalled();
    // Nothing was sent, so strangers cannot use this to spend the account's resends (ENG-3823).
    expect(applyRateLimit).not.toHaveBeenCalled();
  });

  test("resends an SSO recovery email for a verified user", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(mockVerifiedUser as never);
    recoveryIntentMocks.readSsoRecoveryIntent.mockResolvedValue(liveIntent());
    recoveryIntentMocks.getSsoRecoveryPairedTtlSeconds.mockReturnValue(777);

    const response = await resend({ ...validInput, callbackUrl: RECOVERY_CALLBACK });

    // The link and the intent have to get ONE lifetime, or the survivor of the two ends recovery on its
    // own: a longer-lived link signs the user in and then reports failure. `777` is not a TTL either call
    // site could arrive at by itself, so it fails if either computes its own instead of taking the pair.
    expect(recoveryIntentMocks.getSsoRecoveryPairedTtlSeconds).toHaveBeenCalledWith({
      ...liveIntent(),
      createdAt: expect.any(Number),
    });
    expect(recoveryIntentMocks.refreshSsoRecoveryIntent).toHaveBeenCalledWith("test-state", 777);
    expect(sendVerificationEmail).toHaveBeenCalledWith({
      id: mockVerifiedUser.id,
      email: mockVerifiedUser.email,
      locale: "en-US",
      callbackUrl: RECOVERY_CALLBACK,
      purpose: "sso_recovery",
      linkTtlSeconds: 777,
    });
    expect(response.status).toBe(204);
  });

  /**
   * Next resolves `…/complete/` and `/api//auth/…/complete` to the completion route, so a stricter
   * comparison here made the resend no-op while this still answered success and the UI toasted it.
   */
  test.each([
    ["a trailing slash", "http://localhost:3000/api/auth/sso/recovery/complete/?state=test-state"],
    ["an interior repeat", "http://localhost:3000/api//auth/sso/recovery/complete?state=test-state"],
  ])("treats a recovery callback with %s as recovery", async (_label, callbackUrl) => {
    vi.mocked(getUserByEmail).mockResolvedValue(mockVerifiedUser as never);
    recoveryIntentMocks.readSsoRecoveryIntent.mockResolvedValue(liveIntent());

    await resend({ ...validInput, callbackUrl });

    expect(sendVerificationEmail).toHaveBeenCalledWith(expect.objectContaining({ purpose: "sso_recovery" }));
    expect(recoveryIntentMocks.refreshSsoRecoveryIntent).toHaveBeenCalled();
  });

  /**
   * The state id is recovery-shaped but nothing is stored under it. The server cannot tell an expired
   * intent from a consumed one or an invented one — `readSsoRecoveryIntent` returns `null` for all three
   * — so they get one answer, and it is the honest one for the case that actually happens.
   */
  test("reports an expired recovery link rather than a success with no mail sent", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(mockVerifiedUser as never);

    const response = await resend({
      ...validInput,
      callbackUrl: "http://localhost:3000/api/auth/sso/recovery/complete?state=forged-state",
    });

    expect(response.status).toBe(422);
    expect((await response.json()).details).toEqual({ reason: SSO_RECOVERY_LINK_EXPIRED_ERROR_CODE });
    expect(sendVerificationEmail).not.toHaveBeenCalled();
    expect(auditEvents()).toEqual([expect.objectContaining({ status: "failure" })]);
  });

  test("falls back to a normal verification email when the recovery intent belongs to another address", async () => {
    recoveryIntentMocks.readSsoRecoveryIntent.mockResolvedValue({ ...liveIntent("other@example.com") });

    const response = await resend({ ...validInput, callbackUrl: RECOVERY_CALLBACK });

    expect(auth.api.sendVerificationEmail).toHaveBeenCalledWith({
      body: { email: mockUser.email, callbackURL: RECOVERY_CALLBACK },
      headers: expect.any(Headers),
    });
    expect(response.status).toBe(204);
  });

  // ENG-7092 will change this answer; until then it is the server action's, message included.
  test("answers an unknown address as the server action did", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null);

    const response = await resend();

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        detail: "user with ID test@example.com not found",
        details: { reason: "user_not_found" },
      })
    );
    expect(sendVerificationEmail).not.toHaveBeenCalled();
    expect(auth.api.sendVerificationEmail).not.toHaveBeenCalled();
  });

  // ENG-2562: a resent link gets a fresh hour while the intent cookie's clock started at sign-up, so the
  // route re-pairs the cookie with the new link — but only for a browser that already holds a valid
  // cookie naming this user. Anything weaker would let an unauthenticated caller arm sign-up proof for an
  // arbitrary account by asking for a resend.
  describe("Sign-up intent cookie refresh (ENG-2562)", () => {
    beforeEach(() => {
      cookieMocks.get.mockReturnValue({ value: "existing-intent-cookie" });
    });

    test("re-issues the cookie, with the same attributes, when the browser holds a valid one for this user", async () => {
      signupIntentMocks.classifySignupIntent.mockReturnValue("valid");

      await resend();

      expect(signupIntentMocks.classifySignupIntent).toHaveBeenCalledWith(
        "existing-intent-cookie",
        mockUser.id
      );
      expect(signupIntentMocks.createSignupIntentToken).toHaveBeenCalledWith(mockUser.id);
      expect(cookieMocks.set).toHaveBeenCalledWith("formbricks.signup_intent", "fresh-intent-token", {
        httpOnly: true,
        secure: false,
        path: "/",
        sameSite: "lax",
        maxAge: 3600,
      });
    });

    test.each([["absent"], ["invalid"], ["other_user"]])(
      "does not mint a cookie when the browser's proof classifies as %s",
      async (classification) => {
        signupIntentMocks.classifySignupIntent.mockReturnValue(classification as never);

        await resend();

        expect(signupIntentMocks.createSignupIntentToken).not.toHaveBeenCalled();
        expect(cookieMocks.set).not.toHaveBeenCalled();
      }
    );

    test("does not touch the cookie when the user is already verified (no email sent)", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(mockVerifiedUser as never);
      signupIntentMocks.classifySignupIntent.mockReturnValue("valid");

      await resend();

      expect(cookieMocks.set).not.toHaveBeenCalled();
    });
  });
});

describe("POST /api/internal/verification-emails — audit record", () => {
  test("records the send against the account it went to", async () => {
    await resend();

    expect(auditEvents()).toEqual([
      expect.objectContaining({
        action: "verificationEmailSent",
        targetType: "user",
        targetId: mockUser.id,
        status: "success",
      }),
    ]);
  });

  test("names no account when the address is already verified and nothing was sent", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(mockVerifiedUser as never);

    await resend();

    expect(auditEvents()).toEqual([expect.objectContaining({ targetId: "unknown", status: "success" })]);
  });

  test("records an unknown address as a failure", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null);

    await resend();

    expect(auditEvents()).toEqual([expect.objectContaining({ targetId: "unknown", status: "failure" })]);
  });
});

describe("POST /api/internal/verification-emails — errors and input", () => {
  test("lets a lookup failure through as a 500", async () => {
    vi.mocked(getUserByEmail).mockRejectedValue(new Error("Database error"));

    expect((await resend()).status).toBe(500);
    expect(applyIPRateLimit).toHaveBeenCalled();
  });

  test("lets a send failure through as a 500", async () => {
    vi.mocked(auth.api.sendVerificationEmail).mockRejectedValue(new Error("Email service error"));

    expect((await resend()).status).toBe(500);
    expect(getUserByEmail).toHaveBeenCalled();
  });

  test.each([
    ["an empty email", { email: "" }],
    ["a malformed email", { email: "invalid-email" }],
    ["an unknown field", { ...validInput, userId: "someone" }],
    [
      `a callback URL over ${MAX_CALLBACK_URL_LENGTH} characters`,
      { ...validInput, callbackUrl: "x".repeat(MAX_CALLBACK_URL_LENGTH + 1) },
    ],
  ])("answers 400 for %s, before spending any budget", async (_label, body) => {
    expect((await resend(body)).status).toBe(400);
    expect(applyIPRateLimit).not.toHaveBeenCalled();
    expect(getUserByEmail).not.toHaveBeenCalled();
  });

  test(`refuses a body over ${PRE_LOGIN_BODY_LIMIT_BYTES} bytes with 413`, async () => {
    const body = JSON.stringify({ ...validInput, callbackUrl: "x".repeat(PRE_LOGIN_BODY_LIMIT_BYTES) });

    expect((await resend(body)).status).toBe(413);
  });

  test("refuses a cross-site request (CSRF), though there is no session to ride", async () => {
    expect((await resend(validInput, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(applyIPRateLimit).not.toHaveBeenCalled();
  });
});
