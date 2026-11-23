import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { auth } from "@/modules/auth/lib/auth";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { sendVerificationEmail } from "@/modules/email";
import { deliverVerificationEmail } from "./deliver-verification-email";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/auth/lib/auth", () => ({ auth: { api: { sendVerificationEmail: vi.fn() } } }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: { auth: { verifyEmailPerAccount: { namespace: "auth:verify:account" } } },
}));
vi.mock("@/modules/email", () => ({ sendVerificationEmail: vi.fn() }));
const recovery = vi.hoisted(() => ({
  getSsoRecoveryPairedTtlSeconds: vi.fn(() => 777),
  refreshSsoRecoveryIntent: vi.fn(),
}));
vi.mock("@/modules/ee/sso/lib/recovery-intent", () => recovery);

const user = { id: "user-1", email: "ada@example.com", locale: "en-US" as const };
const requestHeaders = new Headers({ "x-test": "1" });

describe("deliverVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sends the Better Auth verification email once the account's budget is charged", async () => {
    await deliverVerificationEmail({
      user,
      callbackUrl: "http://localhost:3000/invite",
      ssoRecoveryResend: null,
      requestHeaders,
    });

    expect(applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.verifyEmailPerAccount, user.id);
    expect(auth.api.sendVerificationEmail).toHaveBeenCalledWith({
      body: { email: user.email, callbackURL: "http://localhost:3000/invite" },
      headers: requestHeaders,
    });
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  test("sends the SSO-recovery mail with the paired lifetime and refreshes the intent with it", async () => {
    const intent = { email: user.email } as never;

    await deliverVerificationEmail({
      user,
      callbackUrl: "http://localhost:3000/cb",
      ssoRecoveryResend: { stateId: "state-1", intent },
      requestHeaders,
    });

    expect(sendVerificationEmail).toHaveBeenCalledWith({
      id: user.id,
      email: user.email,
      locale: user.locale,
      callbackUrl: "http://localhost:3000/cb",
      purpose: "sso_recovery",
      linkTtlSeconds: 777,
      ssoRecoveryStateId: "state-1",
    });
    expect(recovery.refreshSsoRecoveryIntent).toHaveBeenCalledWith("state-1", 777);
    expect(auth.api.sendVerificationEmail).not.toHaveBeenCalled();
  });

  test("sends nothing once the account's budget is spent", async () => {
    vi.mocked(applyRateLimit).mockRejectedValueOnce(new TooManyRequestsError("spent"));

    await expect(
      deliverVerificationEmail({ user, ssoRecoveryResend: null, requestHeaders })
    ).resolves.toBeUndefined();

    expect(auth.api.sendVerificationEmail).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  test.each([
    ["the limiter failing closed", () => vi.mocked(applyRateLimit).mockRejectedValueOnce(new Error("redis"))],
    [
      "the mailer failing",
      () => vi.mocked(auth.api.sendVerificationEmail).mockRejectedValueOnce(new Error("smtp")),
    ],
  ])("never throws on %s: nothing after the response would catch it", async (_label, arrange) => {
    arrange();

    await expect(
      deliverVerificationEmail({ user, ssoRecoveryResend: null, requestHeaders })
    ).resolves.toBeUndefined();
  });
});
