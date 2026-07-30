import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { createUserAction } from "@/modules/auth/signup/actions";
import { sendVerificationLinkEmail } from "@/modules/email";

/**
 * What a failed verification-email send may and may not do to sign-up (ENG-2091 / ENG-2099).
 *
 * MAY NOT: change the response. Better Auth only attempts the send for an address it actually created,
 * so any send outcome reaching the caller would answer "did this address already have an account?" —
 * and anyone who can send an invite could ask. The failure is logged and reported to Sentry instead
 * (auth.ts `sendVerificationEmail`), and the verification-requested screen derives its "nothing was
 * sent" copy from IS_SMTP_CONFIGURED, which does not depend on the address.
 *
 * MUST: still create the account. Better Auth calls the callback through `runInBackgroundOrAwait`,
 * whose catch only logs, so sign-up resolves 200 whatever we throw — the user has a real account and
 * needs the resend path, not a second sign-up.
 */

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, delete: () => undefined })),
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/modules/ee/mailing/lib/mailing-subscription", () => ({
  subscribeUserToMailingList: vi.fn(async () => undefined),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>();
  return { ...actual, queueAuditEventBackground: vi.fn(async () => undefined) };
});

const EMAIL = "newcomer@corporate-example.com";
const signUp = () => createUserAction({ name: "Newcomer", email: EMAIL, password: "Passw0rd!" });

/** The three mailer states the callback has to survive, including both silent-failure modes. */
const MAILER_STATES = [
  { name: "healthy", arrange: () => vi.mocked(sendVerificationLinkEmail).mockResolvedValue(true) },
  {
    name: "throwing (SMTP unreachable)",
    arrange: () =>
      vi.mocked(sendVerificationLinkEmail).mockRejectedValue(new Error("smtp connection refused")),
  },
  {
    // sendEmail returns false without throwing when SMTP isn't configured, and Better Auth ignores the
    // return value entirely — so this mode is silent on every path unless we check it.
    name: "returning false (SMTP unconfigured)",
    arrange: () => vi.mocked(sendVerificationLinkEmail).mockResolvedValue(false),
  },
];

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  vi.mocked(sendVerificationLinkEmail).mockResolvedValue(true);
});

describe("verification email send failures during sign-up (real Postgres)", () => {
  test.each(MAILER_STATES)("a $name mailer still creates the account", async ({ arrange }) => {
    arrange();

    const result = await signUp();

    // Asserting success here pins the behaviour against a future Better Auth version that starts
    // propagating the throw instead of swallowing it — that would leave the account created but the
    // sign-up looking failed, driving the user to retry into a duplicate.
    expect(result?.data).toEqual({ success: true });
    expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(1);
  });

  // The ENG-2099 invariant, asserted directly: a mail outage must not be visible in the response.
  // Without this, "we couldn't send it" answers as reliably as "this address is taken" — the outage
  // shows up for a fresh address and never for one that already has an account.
  test("returns a byte-identical response in every mailer state", async () => {
    const responses: unknown[] = [];
    for (const { arrange } of MAILER_STATES) {
      await resetDb();
      vi.clearAllMocks();
      arrange();
      const result = await signUp();
      responses.push({ data: result?.data, serverError: result?.serverError });
    }

    for (const response of responses) {
      expect(response).toEqual(responses[0]);
    }
  });
});
