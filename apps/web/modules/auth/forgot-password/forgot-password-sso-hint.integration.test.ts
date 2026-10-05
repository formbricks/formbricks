import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { sendPasswordResetLinkEmail, sendSsoSignInHintEmail } from "@/modules/email";
import { forgotPasswordAction } from "./actions";

/**
 * ENG-3262 at the action boundary: real `forgotPasswordAction` → real Postgres → real Better Auth, with
 * only the mailer captured.
 *
 * The provider names come from `Account` rows, so this is what proves the query, the legacy-id
 * normalization and the routing between "reset link" and "SSO hint" agree on rows stored the way
 * production stores them. The action answers `{ success: true }` either way, so every test asserts on
 * which mail went out.
 */

// No Next request scope under vitest; the action reads headers for rate limiting and for Better Auth.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, delete: () => undefined })),
  headers: vi.fn(async () => new Headers()),
}));

// Pinned rather than inherited from `.env`: either flag at its other value routes every user away from
// the branch under test, and the suite would pass or fail on the developer's env instead of the code.
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  PASSWORD_RESET_DISABLED: false,
  EMAIL_AUTH_ENABLED: true,
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>();
  return { ...actual, queueAuditEventBackground: vi.fn(async () => undefined) };
});

const SSO_EMAIL = "silvija@corporate-example.com";

/** An SSO-provisioned user: an `azuread` account row and no credential row, so no password exists. */
const seedSsoUser = async (extraProviders: string[] = []) =>
  prisma.user.create({
    data: {
      name: "Silvija",
      email: SSO_EMAIL,
      emailVerified: true,
      locale: "nl-NL",
      identityProvider: "azuread",
      identityProviderAccountId: "azure-object-id-123",
      accounts: {
        create: ["azuread", ...extraProviders].map((provider) => ({
          type: "oauth",
          provider,
          providerAccountId: `${provider}-subject`,
        })),
      },
    },
  });

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("forgotPasswordAction for an account without a password (real Postgres + Better Auth)", () => {
  test("mails an SSO-only user which provider to sign in with, and no reset link", async () => {
    await seedSsoUser();

    const result = await forgotPasswordAction({ email: SSO_EMAIL });

    expect(result?.data).toEqual({ success: true });
    expect(sendSsoSignInHintEmail).toHaveBeenCalledExactlyOnceWith({
      email: SSO_EMAIL,
      locale: "nl-NL",
      providerNames: ["Microsoft"],
    });
    expect(sendPasswordResetLinkEmail).not.toHaveBeenCalled();
  });

  test("names every provider linked to the account, including a legacy `azure-ad` row only once", async () => {
    await seedSsoUser(["google", "azure-ad"]);

    await forgotPasswordAction({ email: SSO_EMAIL });

    expect(vi.mocked(sendSsoSignInHintEmail).mock.calls[0]?.[0].providerNames).toEqual([
      "Microsoft",
      "Google",
    ]);
  });

  test("sends a password user their reset link and no hint", async () => {
    // The control: without it, routing every user to the hint would leave the tests above green.
    await auth.api.signUpEmail({
      body: { email: "alice@corporate-example.com", password: "Passw0rd!", name: "Alice" },
    });

    await forgotPasswordAction({ email: "alice@corporate-example.com" });

    expect(sendPasswordResetLinkEmail).toHaveBeenCalledOnce();
    expect(sendSsoSignInHintEmail).not.toHaveBeenCalled();
  });

  test("sends nothing for an address that belongs to no account", async () => {
    const result = await forgotPasswordAction({ email: "nobody@corporate-example.com" });

    expect(result?.data).toEqual({ success: true });
    expect(sendSsoSignInHintEmail).not.toHaveBeenCalled();
    expect(sendPasswordResetLinkEmail).not.toHaveBeenCalled();
  });
});
