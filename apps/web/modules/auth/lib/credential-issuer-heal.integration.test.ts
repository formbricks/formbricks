import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE } from "@formbricks/types/errors";
import { resetDb } from "@/integration/reset-db";
import { forgotPasswordAction } from "@/modules/auth/forgot-password/actions";
import { resetPasswordAction } from "@/modules/auth/forgot-password/reset/actions";
import { auth } from "@/modules/auth/lib/auth";
import { sendPasswordResetLinkEmail } from "@/modules/email";

/**
 * ENG-3258 against real Postgres + real Better Auth: a credential `Account` row whose `issuer` is NULL,
 * the shape a 1.6 pod writes during a rolling upgrade. Better Auth 1.7 filters its credential lookup on
 * `issuer`, so the bug only exists where that real query runs against a real row.
 */

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, delete: () => undefined })),
  headers: vi.fn(async () => new Headers()),
}));

// Pin the flags the reset actions gate on, so the suite does not depend on the developer's `.env`.
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  PASSWORD_RESET_DISABLED: false,
  EMAIL_AUTH_ENABLED: true,
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>();
  return { ...actual, queueAuditEventBackground: vi.fn(async () => undefined) };
});

const EMAIL = "null-issuer@example.com";
const PASSWORD = "Passw0rd!";
const NEW_PASSWORD = "N3wPassw0rd!";

const dropCredentialIssuer = () =>
  prisma.account.updateMany({ where: { provider: "credential" }, data: { issuer: null } });

/** Requests a reset link through the real action and returns the token from the captured mail. */
const requestResetToken = async (): Promise<string> => {
  await forgotPasswordAction({ email: EMAIL });
  const link = vi.mocked(sendPasswordResetLinkEmail).mock.calls.at(-1)?.[0].verifyLink ?? "";
  const token = /\/reset-password\/([^?]+)/.exec(link)?.[1];
  if (!token) throw new Error(`No reset token in the captured mail link: "${link}"`);
  return token;
};

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  vi.mocked(sendPasswordResetLinkEmail).mockResolvedValue(true);

  await auth.api.signUpEmail({ body: { email: EMAIL, password: PASSWORD, name: "Null Issuer" } });
  // Sign-in requires a verified address; that gate is not what this suite is about.
  await prisma.user.update({ where: { email: EMAIL }, data: { emailVerified: true } });
  await dropCredentialIssuer();
});

describe("credential row with a NULL issuer (real Postgres + Better Auth)", () => {
  test("signs in with the correct password", async () => {
    const result = await auth.api.signInEmail({ body: { email: EMAIL, password: PASSWORD } });

    expect(result.user.email).toBe(EMAIL);
  });

  test("resets the password from a newly requested link, and the new password signs in", async () => {
    const token = await requestResetToken();

    const result = await resetPasswordAction({ token, password: NEW_PASSWORD });

    expect(result?.data).toEqual({ success: true });
    const signIn = await auth.api.signInEmail({ body: { email: EMAIL, password: NEW_PASSWORD } });
    expect(signIn.user.email).toBe(EMAIL);
  });

  test("a link issued before the heal fails as an invalid link, not a server error", async () => {
    // The link was mailed while the row was still NULL, i.e. before this fix was deployed: request it
    // (which heals), then put the row back the way it was when that link went out.
    const token = await requestResetToken();
    await dropCredentialIssuer();

    const result = await resetPasswordAction({ token, password: NEW_PASSWORD });

    expect(result?.serverError).toBe(INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE);
  });
});
