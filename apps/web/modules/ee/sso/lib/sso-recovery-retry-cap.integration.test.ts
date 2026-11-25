import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { WEBAPP_URL } from "@/lib/constants";
import { ssoRecoveryAfterHandler } from "@/modules/ee/sso/lib/better-auth-hooks";
import { captureSsoIdentity, runWithSsoRequestContext } from "@/modules/ee/sso/lib/sso-request-context";
import { sendVerificationEmail } from "@/modules/email";
import { applyEmailRateLimits, emailRateLimits } from "@/modules/email/lib/email-rate-limits";

/**
 * ENG-2558 end to end, through the hook the IdP callback runs, against real Postgres and real Redis.
 *
 * Every retry of an SSO sign-in that collides with an existing account starts recovery again and mails
 * the account owner. The recovery email is capped at 5 an hour per recipient (`email-rate-limits.ts`), so
 * the sixth retry is refused by the mailer. That refusal is a `TooManyRequestsError`, not an APIError, and
 * this hook runs in Better Auth's `hooks.after`, where such a throw became a 500 with an empty body. The
 * user saw a blank page on every further retry. They must land on the recovery-failure page instead.
 *
 * `getOAuthState` is stubbed, because reading it needs a live Better Auth request context. The harness
 * stubs the mailer (`integration/setup.ts`); here the stub charges the real email rate limit in Redis
 * before it reports a send, as `sendEmail` does before it opens an SMTP connection.
 */

const mocks = vi.hoisted(() => ({ getOAuthState: vi.fn() }));

vi.mock("better-auth/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("better-auth/api")>()),
  getOAuthState: mocks.getOAuthState,
}));

// The integration setup turns rate limiting off for every suite; this one is about hitting a limit.
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  RATE_LIMITING_DISABLED: false,
}));

// Fires inside setImmediate and calls getClientIpFromHeaders() outside a request scope.
vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>()),
  queueAuditEventBackground: vi.fn(async () => undefined),
}));

// Unique per run: the per-recipient counter lives in Redis for an hour.
const ACCOUNT_EMAIL = `retry-cap-${Date.now()}@example.com`;
const RECOVERY_EMAILS_PER_HOUR =
  emailRateLimits.sso_recovery_verification.recipient?.total?.allowedPerInterval ?? 0;
const CALLBACK_URL = `${WEBAPP_URL}/organizations/org_retry/workspaces/ws_retry/surveys`;

/** One SSO sign-in attempt that collides with the existing account. Returns where the browser is sent. */
const retrySignIn = async (attempt: number): Promise<string> => {
  let redirectedTo = "";
  const redirect = (url: string) => {
    redirectedTo = url;
    return new Error("sso-recovery-redirect");
  };
  const ctx = {
    path: "/callback/:id",
    params: { id: "google" },
    context: {
      responseHeaders: new Headers({ location: `${WEBAPP_URL}/auth/login?error=account_not_linked` }),
    },
    redirect,
  };

  await runWithSsoRequestContext(async () => {
    captureSsoIdentity({ email: ACCOUNT_EMAIL, providerAccountId: `google-sub-${attempt}` });
    // Matched on the sentinel: any other throw is what Better Auth turns into a bodiless 500.
    await expect(ssoRecoveryAfterHandler(ctx as never)).rejects.toThrow("sso-recovery-redirect");
  });

  return redirectedTo;
};

describe("SSO recovery past the recovery-email cap (real Postgres + Redis + email rate limit)", () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
    mocks.getOAuthState.mockResolvedValue({ callbackURL: CALLBACK_URL });
    // Recovery sends with `purpose: "sso_recovery"`, which `sendVerificationEmail` sends as this type.
    vi.mocked(sendVerificationEmail).mockImplementation(async ({ email }) => {
      await applyEmailRateLimits("sso_recovery_verification", email);
      return true;
    });
  });

  test("a retry past the per-recipient cap redirects to the recovery-failure page instead of throwing", async () => {
    await prisma.user.create({
      data: { email: ACCOUNT_EMAIL, name: "Retry Tester", emailVerified: true, locale: "en-US" },
    });

    for (let attempt = 0; attempt < RECOVERY_EMAILS_PER_HOUR; attempt++) {
      expect(await retrySignIn(attempt)).toContain("/auth/verification-requested");
    }

    expect(RECOVERY_EMAILS_PER_HOUR).toBeGreaterThan(0);
    expect(sendVerificationEmail).toHaveBeenCalledTimes(RECOVERY_EMAILS_PER_HOUR);
    expect(sendVerificationEmail).toHaveBeenCalledWith(expect.objectContaining({ purpose: "sso_recovery" }));

    const failure = new URL(await retrySignIn(RECOVERY_EMAILS_PER_HOUR));
    expect(failure.pathname).toBe("/auth/login");
    expect(failure.searchParams.get("error")).toBe("OAuthAccountNotLinked");
    expect(failure.searchParams.get("callbackUrl")).toBe(CALLBACK_URL);
  });
});
