import { beforeEach, describe, expect, test, vi } from "vitest";
import { createToken } from "@/lib/jwt";
import { VERIFICATION_LINK_TTL_SECONDS } from "@/modules/auth/lib/verification-links";

/**
 * The one guarantee `VERIFICATION_LINK_TTL_SECONDS` exists to make.
 *
 * `verification-links.ts` says the constant is shared so the emailed link and the SSO recovery intent
 * cannot drift apart — a link that outlives its intent signs the user in and then tells them recovery
 * failed. Nothing pinned the email half of that: changing `expiresIn` here to `"1h"` left the whole
 * suite green, which is exactly the drift the constant was introduced to prevent.
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

  test("the shared TTL is one day, which is the window the intent is paired to", () => {
    expect(VERIFICATION_LINK_TTL_SECONDS).toBe(60 * 60 * 24);
  });
});
