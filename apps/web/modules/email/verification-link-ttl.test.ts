import { beforeEach, describe, expect, test, vi } from "vitest";
import { createToken } from "@/lib/jwt";
import { VERIFICATION_LINK_TTL_SECONDS } from "@/modules/auth/lib/verification-links";

/**
 * The one guarantee `VERIFICATION_LINK_TTL_SECONDS` exists to make.
 *
 * `verification-links.ts` says the constant is shared so the emailed link and the SSO recovery intent
 * cannot drift apart — a link that outlives its intent signs the user in and then tells them recovery
 * failed, and an intent that outlives its link keeps authorising a password-and-2FA strip after the
 * mail is dead. Nothing pinned the email half of that: changing `expiresIn` here to `"1h"` left the
 * whole suite green, which is exactly the drift the constant was introduced to prevent.
 *
 * The absolute number is pinned here too, deliberately and in one place. It is a security window, not
 * an implementation detail — lengthening it widens the strongest capability the product hands out over
 * email — so a change to it should have to be a change to a test that says so.
 */

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(async () => ({ messageId: "1" })),
  createToken: vi.fn(() => "recovery-token"),
  createEmailToken: vi.fn(() => "email-token"),
}));

vi.mock("nodemailer", () => ({
  createTransport: () => ({ sendMail: mocks.sendMail, verify: vi.fn(async () => true), close: vi.fn() }),
}));
vi.mock("@/lib/jwt", () => ({ createToken: mocks.createToken, createEmailToken: mocks.createEmailToken }));
vi.mock("@/lingodotdev/server", () => ({ getTranslate: async () => (key: string) => key }));
vi.mock("@/lib/organization/service", () => ({ getOrganizationByWorkspaceId: vi.fn() }));
vi.mock("@formbricks/email", () => ({
  renderVerificationEmail: vi.fn(async () => "<html>verify</html>"),
}));

const { sendVerificationEmail } = await import("./index");

describe("the emailed verification link's lifetime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createToken.mockReturnValue("recovery-token");
    mocks.createEmailToken.mockReturnValue("email-token");
  });

  test.each(["sso_recovery", "email_verification"] as const)(
    "mints the %s token with the shared link TTL, not a literal",
    async (purpose) => {
      await sendVerificationEmail({
        id: "user_1",
        email: "someone@example.com",
        locale: "en-US",
        callbackUrl: "http://localhost:3000/x",
        purpose,
      });

      expect(createToken).toHaveBeenCalledWith("user_1", {
        expiresIn: VERIFICATION_LINK_TTL_SECONDS,
        purpose,
      });
    }
  );

  test("a caller may shorten the link, which is how a resend stays paired with a capped intent", async () => {
    await sendVerificationEmail({
      id: "user_1",
      email: "someone@example.com",
      locale: "en-US",
      callbackUrl: "http://localhost:3000/x",
      purpose: "sso_recovery",
      linkTtlSeconds: 90,
    });

    expect(createToken).toHaveBeenCalledWith("user_1", { expiresIn: 90, purpose: "sso_recovery" });
  });

  /**
   * Fifteen minutes, and pinned because it is a security window rather than a tuning knob: completing
   * recovery clears the password and deletes the second factor, and the link stays replayable for its
   * whole life. Every bar for an emailed credential of this strength sits at or under an hour — NIST
   * SP 800-63B-4 s3.1.3.2 (10 min, SHALL), RFC 6749 s4.1.2 (10 min RECOMMENDED for an authorization
   * code), RFC 9126 s2.2 (a `request_uri` at 5-600s), OWASP WSTG 4.9 ("rarely be more than an hour")
   * — and our own password reset, which leaves 2FA armed, defaults to 30 minutes.
   */
  test("the shared TTL is fifteen minutes, which is the window the intent is paired to", () => {
    expect(VERIFICATION_LINK_TTL_SECONDS).toBe(60 * 15);
  });
});
