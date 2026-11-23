import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { POST as postSignup } from "@/app/api/internal/signups/route";
import { flushAfter } from "@/integration/after";
import { postToPreLoginRoute, withoutEmailToken } from "@/integration/pre-login-routes";
import { resetDb } from "@/integration/reset-db";
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
 * MUST: still create the account. Inside the sign-up route the callback hands the send to `after()`
 * (ENG-7094), so a failure surfaces after the response, where it is logged — the user has a real account
 * and needs the resend path, not a second sign-up.
 */

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined })),
  headers: vi.fn(async () => new Headers()),
}));

// `after()` needs a Next request scope. Sign-up defers the verification send and all new-account work
// to it (ENG-7094), so the suite flushes it after each call, as a finished request would.
vi.mock("next/server", async (importOriginal) =>
  (await import("@/integration/after")).withAfterMock(await importOriginal<typeof import("next/server")>())
);

vi.mock("@/modules/ee/mailing/lib/mailing-subscription", () => ({
  subscribeUserToMailingList: vi.fn(async () => undefined),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>();
  return { ...actual, queueAuditEventBackground: vi.fn(async () => undefined) };
});

/** The sign-up form's request, through the real `POST /api/internal/signups`. */
const createSignup = (body: Record<string, unknown>) =>
  postToPreLoginRoute(postSignup, "/api/internal/signups", body);

const EMAIL = "newcomer@corporate-example.com";
const callSignUp = () => createSignup({ name: "Newcomer", email: EMAIL, password: "Passw0rd!" });

/** Sign up and let the after-response work finish, as a real request would. */
const signUp = async () => {
  const result = await callSignUp();
  await flushAfter();
  return result;
};

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
    expect(result.data).toEqual({ success: true, emailToken: expect.any(String) });
    expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(1);
  });

  // ENG-7094: Better Auth only sends for an address it just created, so a send on the response path made
  // a free address answer slower than a registered one. Driven through real Better Auth and the real
  // route, so this also pins that its sign-up still reaches our callback inside the sign-up scope.
  test("sends the verification email only after the response", async () => {
    const result = await callSignUp();

    expect(result.status).toBe(200);
    expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(1);
    expect(sendVerificationLinkEmail).not.toHaveBeenCalled();

    await flushAfter();

    expect(sendVerificationLinkEmail).toHaveBeenCalledTimes(1);
    expect(sendVerificationLinkEmail).toHaveBeenCalledWith(expect.objectContaining({ email: EMAIL }));
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
      responses.push(withoutEmailToken(result));
    }

    for (const response of responses) {
      expect(response).toEqual(responses[0]);
    }
  });
});
