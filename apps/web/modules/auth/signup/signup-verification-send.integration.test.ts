import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { createUserAction } from "@/modules/auth/signup/actions";
import { sendVerificationLinkEmail } from "@/modules/email";

/**
 * A failed verification-email send must never present as a successful one (ENG-2091).
 *
 * Better Auth calls our `sendVerificationEmail` callback through `runInBackgroundOrAwait` on the
 * sign-up path, and that helper's catch ONLY LOGS — so sign-up resolves 200 whatever we throw. These
 * tests pin both halves of that: sign-up still succeeds (so the user isn't left with an account they
 * can't see), AND the action reports the failure so the form stops claiming an email is on its way.
 *
 * They also pin the ordering dependency: the outcome is only readable because no
 * `advanced.backgroundTasks.handler` is configured, which makes the callback run inline. Configuring
 * one would make the send genuinely async and break this — these tests are what makes that loud.
 */

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, delete: () => undefined })),
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/modules/email", () => ({
  sendVerificationLinkEmail: vi.fn(async () => true),
  sendPasswordResetLinkEmail: vi.fn(async () => undefined),
  sendPasswordResetNotifyEmail: vi.fn(async () => undefined),
  sendDeleteAccountConfirmationEmail: vi.fn(async () => undefined),
  sendInviteAcceptedEmail: vi.fn(async () => undefined),
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
  identifyPostHogPerson: vi.fn(),
  groupIdentifyPostHog: vi.fn(),
}));

vi.mock("@/modules/ee/mailing/lib/mailing-subscription", () => ({
  subscribeUserToMailingList: vi.fn(async () => undefined),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>();
  return { ...actual, queueAuditEventBackground: vi.fn(async () => undefined) };
});

const EMAIL = "newcomer@corporate-example.com";
const signUp = () =>
  createUserAction({ name: "Newcomer", email: EMAIL, password: "Passw0rd!" });

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  vi.mocked(sendVerificationLinkEmail).mockResolvedValue(true);
});

describe("verification email send failures during sign-up (real Postgres)", () => {
  test("a healthy send routes the user to their inbox", async () => {
    const result = await signUp();

    expect(result?.data).toEqual({ success: true, nextStep: "verify_email" });
    expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(1);
  });

  test("a THROWING mailer: account still created, and the failure is reported", async () => {
    vi.mocked(sendVerificationLinkEmail).mockRejectedValue(new Error("smtp connection refused"));

    const result = await signUp();

    // Better Auth swallows the throw, so sign-up must still succeed — asserting this pins the
    // behaviour against a future Better Auth version that starts propagating instead.
    expect(result?.data).toEqual({ success: true, nextStep: "verification_send_failed" });
    // The account really is there; the user needs the resend path, not a second sign-up.
    expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(1);
  });

  test("a mailer returning FALSE (SMTP unconfigured) is treated the same as a throw", async () => {
    // sendEmail returns false without throwing when IS_SMTP_CONFIGURED is false, and Better Auth
    // ignores the return value entirely — so this mode is silent on every path unless we check it.
    vi.mocked(sendVerificationLinkEmail).mockResolvedValue(false);

    const result = await signUp();

    expect(result?.data).toEqual({ success: true, nextStep: "verification_send_failed" });
    expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(1);
  });

  test("the failure does not leak into a later sign-up in the same process", async () => {
    vi.mocked(sendVerificationLinkEmail).mockRejectedValue(new Error("smtp connection refused"));
    await signUp();

    // Fresh request scope: a recovered mailer must report success, not the previous failure.
    await resetDb();
    vi.mocked(sendVerificationLinkEmail).mockResolvedValue(true);
    const result = await signUp();

    expect(result?.data).toEqual({ success: true, nextStep: "verify_email" });
  });
});
