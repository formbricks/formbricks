import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { hasCredentialAccount } from "@/lib/user/password";
import { sendSsoSignInHint } from "@/modules/auth/forgot-password/lib/sso-sign-in-hint";
import { auth } from "@/modules/auth/lib/auth";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { processPasswordResetRequest } from "./password-reset-request";

const mocks = vi.hoisted(() => ({
  // Held in a box and exposed through a getter so a single test can flip it: `EMAIL_AUTH_ENABLED` is a
  // const import in the module, and the getter keeps the live binding readable per call.
  emailAuthEnabled: { value: true },
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/constants", () => ({
  get EMAIL_AUTH_ENABLED() {
    return mocks.emailAuthEnabled.value;
  },
  WEBAPP_URL: "http://localhost:3000",
}));

// Mocked at the module boundary rather than letting the real one load: `lib/user/password` pulls in
// `lib/crypto`, which reads ENCRYPTION_KEY from the (fully replaced) constants mock at import time.
vi.mock("@/lib/user/password", () => ({ hasCredentialAccount: vi.fn() }));
vi.mock("@/modules/auth/lib/user", () => ({ getUserByEmail: vi.fn() }));
vi.mock("@/modules/auth/lib/auth", () => ({ auth: { api: { requestPasswordReset: vi.fn() } } }));
vi.mock("@/modules/auth/forgot-password/lib/sso-sign-in-hint", () => ({ sendSsoSignInHint: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEventWithoutRequest: vi.fn() }));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

type TFoundUser = NonNullable<Awaited<ReturnType<typeof getUserByEmail>>>;
const foundUser = (identityProvider: TFoundUser["identityProvider"]): TFoundUser => ({
  id: "user123",
  email: "stored@example.com",
  locale: "en-US",
  emailVerified: true,
  isActive: true,
  identityProvider,
});

const requestHeaders = new Headers({ "user-agent": "vitest" });
const process = () =>
  processPasswordResetRequest({ email: "Stored@Example.com", requestHeaders, ipAddress: "203.0.113.7" });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.emailAuthEnabled.value = true;
});

describe("processPasswordResetRequest", () => {
  describe("who gets which mail", () => {
    test("requests a reset for an email-identity user, at the stored address", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(foundUser("email"));

      await process();

      expect(getUserByEmail).toHaveBeenCalledWith("Stored@Example.com");
      expect(auth.api.requestPasswordReset).toHaveBeenCalledExactlyOnceWith({
        body: { email: "stored@example.com", redirectTo: "http://localhost:3000/auth/forgot-password/reset" },
        headers: requestHeaders,
      });
      expect(sendSsoSignInHint).not.toHaveBeenCalled();
      // Short-circuits on `identityProvider === "email"`, so the extra query never runs for the common case.
      expect(hasCredentialAccount).not.toHaveBeenCalled();
    });

    test("sends nothing for an address with no account", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      await process();

      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
      expect(sendSsoSignInHint).not.toHaveBeenCalled();
      // Nothing is charged to a budget either: there is no account to charge.
      expect(applyRateLimit).not.toHaveBeenCalled();
    });

    test("sends an SSO user with no credential account the sign-in hint, not a reset (ENG-3262)", async () => {
      const ssoUser = foundUser("azuread");
      vi.mocked(getUserByEmail).mockResolvedValue(ssoUser);
      vi.mocked(hasCredentialAccount).mockResolvedValue(false);

      await process();

      expect(sendSsoSignInHint).toHaveBeenCalledExactlyOnceWith(ssoUser);
      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
    });

    /**
     * SSO recovery is one-way: it flips `identityProvider` to the SSO provider and nothing flips it back,
     * while clearing the password it found. Gated on `identityProvider` alone these users could never ask
     * for a reset again, so the surviving credential `Account` row is what lets them back in (ENG-2557).
     */
    test("requests a reset for an SSO-identity user who still has a credential account", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(foundUser("google"));
      vi.mocked(hasCredentialAccount).mockResolvedValue(true);

      await process();

      expect(hasCredentialAccount).toHaveBeenCalledWith("user123");
      expect(auth.api.requestPasswordReset).toHaveBeenCalledOnce();
      expect(sendSsoSignInHint).not.toHaveBeenCalled();
    });

    test("on an SSO-only instance, sends the hint even to a user with a credential account", async () => {
      // Handing a password back where the operator disabled credential auth would be the "sign in around
      // the IdP" bypass that switching it off exists to prevent.
      mocks.emailAuthEnabled.value = false;
      vi.mocked(getUserByEmail).mockResolvedValue(foundUser("google"));
      vi.mocked(hasCredentialAccount).mockResolvedValue(true);

      await process();

      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
      expect(sendSsoSignInHint).toHaveBeenCalledOnce();
    });

    test("sends nothing when it cannot tell whether the user has a password", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(foundUser("google"));
      vi.mocked(hasCredentialAccount).mockRejectedValue(new Error("db down"));

      await process();

      // The hint says "your account does not use a password", which a failed lookup cannot vouch for.
      expect(sendSsoSignInHint).not.toHaveBeenCalled();
      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
      expect(applyRateLimit).not.toHaveBeenCalled();
    });
  });

  describe("per-account limit (ENG-3640)", () => {
    test("charges each mail to the account it is for", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(foundUser("email"));

      await process();

      expect(applyRateLimit).toHaveBeenCalledExactlyOnceWith(
        { interval: 3600, allowedPerInterval: 3, namespace: "auth:forgot:account" },
        "user123"
      );
      expect(applyRateLimit).toHaveBeenCalledBefore(vi.mocked(auth.api.requestPasswordReset));
    });

    test("sends no reset once the account's budget is spent", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(foundUser("email"));
      vi.mocked(applyRateLimit).mockRejectedValue(new TooManyRequestsError("limit"));

      await expect(process()).resolves.toBeUndefined();

      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
      expect(queueAuditEventWithoutRequest).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        { userId: "user123" },
        "Forgot-password mail skipped: per-account limit reached"
      );
    });

    test("sends no hint once the account's budget is spent — one budget covers both mails", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(foundUser("azuread"));
      vi.mocked(hasCredentialAccount).mockResolvedValue(false);
      vi.mocked(applyRateLimit).mockRejectedValue(new TooManyRequestsError("limit"));

      await process();

      expect(sendSsoSignInHint).not.toHaveBeenCalled();
    });

    test("logs, rather than mistaking for a spent budget, any other limiter failure", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(foundUser("email"));
      const error = new Error("unexpected");
      vi.mocked(applyRateLimit).mockRejectedValue(error);

      await expect(process()).resolves.toBeUndefined();

      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        { err: error },
        "Forgot-password request failed after the response"
      );
    });
  });

  describe("audit record", () => {
    test("records the reset against the account it was requested for, with the request's IP", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(foundUser("email"));

      await process();

      expect(queueAuditEventWithoutRequest).toHaveBeenCalledExactlyOnceWith({
        action: "passwordReset",
        targetType: "user",
        // Unauthenticated by design, so the actor is unknown — the honest record is that someone who
        // knows the address asked for a reset.
        userId: "unknown",
        userType: "user",
        targetId: "user123",
        organizationId: "unknown",
        status: "success",
        ipAddress: "203.0.113.7",
      });
    });

    test("records nothing when the reset request fails, so the trail never claims one was made", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(foundUser("email"));
      vi.mocked(auth.api.requestPasswordReset).mockRejectedValue(new Error("db down"));

      await process();

      expect(queueAuditEventWithoutRequest).not.toHaveBeenCalled();
    });

    test("records no password reset for the SSO hint, which is not one", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(foundUser("azuread"));
      vi.mocked(hasCredentialAccount).mockResolvedValue(false);

      await process();

      expect(queueAuditEventWithoutRequest).not.toHaveBeenCalled();
    });
  });

  describe("never throws, since nothing after the response would catch it", () => {
    test("swallows and logs a failed user lookup", async () => {
      const error = new Error("db down");
      vi.mocked(getUserByEmail).mockRejectedValue(error);

      await expect(process()).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        { err: error },
        "Forgot-password request failed after the response"
      );
    });

    test("swallows and logs a failed reset request", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(foundUser("email"));
      vi.mocked(auth.api.requestPasswordReset).mockRejectedValue(new Error("smtp down"));

      await expect(process()).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledOnce();
    });
  });
});
