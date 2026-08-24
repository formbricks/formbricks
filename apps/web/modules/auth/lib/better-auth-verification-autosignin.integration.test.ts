import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { runWithEmailVerificationRequestContext } from "@/modules/auth/lib/email-verification-request-context";
import { SIGNUP_INTENT_COOKIE_NAME, createSignupIntentToken } from "@/modules/auth/lib/signup-intent";
import { sendVerificationLinkEmail } from "@/modules/email";

/**
 * ENG-2562 against a real Postgres and a real Better Auth hook chain.
 *
 * Asserts through sessions rather than columns, because the defect is a session that should not exist:
 * `emailVerified` is `true` on every path here — that write is correct, the mailbox really was proven —
 * so a column-level assertion would call the vulnerable behaviour a pass.
 *
 * The verification request is wrapped in `runWithEmailVerificationRequestContext` because that is what
 * the `/api/auth/[...all]` route does in production; the store is how "this request just verified
 * someone" reaches the after-hook. Without it a server-side `auth.api.verifyEmail` withholds the
 * session by design, which auth-email-verification.integration.test.ts covers.
 */

const VICTIM = "victim@example.com";
const ATTACKER_PASSWORD = "AttackerPassw0rd!";

const tokenFromLink = (link: string): string => new URL(link).searchParams.get("token") ?? "";

/** Sign up and return the verification token that was mailed, plus the created user's id. */
const signUpAndCaptureToken = async (): Promise<{ token: string; userId: string }> => {
  await auth.api.signUpEmail({
    body: { email: VICTIM, password: ATTACKER_PASSWORD, name: "Vic" },
    asResponse: true,
  });
  const user = await prisma.user.findUnique({ where: { email: VICTIM } });
  const token = tokenFromLink(vi.mocked(sendVerificationLinkEmail).mock.calls[0][0].verifyLink);

  return { token, userId: user!.id };
};

/** Drive `/verify-email` the way the route does, optionally carrying a sign-up intent cookie. */
const verifyEmail = async (token: string, intentCookieValue?: string): Promise<void> => {
  const headers = new Headers();
  if (intentCookieValue) {
    headers.set("cookie", `${SIGNUP_INTENT_COOKIE_NAME}=${intentCookieValue}`);
  }

  await runWithEmailVerificationRequestContext(async () => {
    // asResponse so the thrown redirect on the withheld path is returned rather than propagated.
    await auth.api.verifyEmail({ query: { token }, headers, asResponse: true });
  });
};

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("post-verification auto-sign-in (real Postgres)", () => {
  test("withholds the session when the verifying browser did not sign up", async () => {
    const { token } = await signUpAndCaptureToken();

    // The victim clicks the link the attacker's sign-up caused to be sent. Their browser carries no
    // sign-up intent cookie, because they never signed up.
    await verifyEmail(token);

    // The address is verified — that part is correct and unchanged.
    expect((await prisma.user.findUnique({ where: { email: VICTIM } }))?.emailVerified).toBe(true);
    // But no session exists, so the victim is never signed into the attacker's account. Before this
    // fix this count was 1, and that session is the whole vulnerability.
    expect(await prisma.session.count()).toBe(0);
  });

  test("mints the session when the intent cookie names the just-verified user", async () => {
    const { token, userId } = await signUpAndCaptureToken();

    // Same browser that signed up: the ENG-1746 land-in-the-app UX this fix is careful to preserve.
    await verifyEmail(token, createSignupIntentToken(userId));

    expect(await prisma.session.count()).toBe(1);
    const session = await prisma.session.findFirst();
    expect(session?.userId).toBe(userId);
  });

  test("withholds when the intent cookie names a different account", async () => {
    const { token } = await signUpAndCaptureToken();

    // A cookie from an earlier, unrelated sign-up in the same browser must not buy a session here:
    // proof of registering account A is not proof of registering account B.
    await verifyEmail(token, createSignupIntentToken("some_other_user_id"));

    expect(await prisma.session.count()).toBe(0);
  });

  test("withholds when the intent cookie is not a sign-up intent token", async () => {
    const { token, userId } = await signUpAndCaptureToken();

    // Correctly signed with the same secret, wrong purpose — the shared-keyspace confusion the
    // dedicated verifier exists to refuse. Uses the app's own token minter for a different flow.
    const { createToken } = await import("@/lib/jwt");
    await verifyEmail(token, createToken(userId, { purpose: "sso_recovery" }));

    expect(await prisma.session.count()).toBe(0);
  });

  test("withholds when the intent cookie is garbage, rather than failing the verification", async () => {
    const { token } = await signUpAndCaptureToken();

    await verifyEmail(token, "not-a-jwt");

    // Verified (so the user is not stranded) but not signed in.
    expect((await prisma.user.findUnique({ where: { email: VICTIM } }))?.emailVerified).toBe(true);
    expect(await prisma.session.count()).toBe(0);
  });

  test("the attacker's password still works afterwards — the documented residual", async () => {
    const { token } = await signUpAndCaptureToken();
    await verifyEmail(token);

    // Stated as a test rather than left implicit: this fix withholds the session, it does not evict
    // the squatter. If a later change makes it destructive, this row should be updated deliberately —
    // not discovered in production.
    const signIn = await auth.api.signInEmail({
      body: { email: VICTIM, password: ATTACKER_PASSWORD },
      asResponse: true,
    });
    expect(signIn.status).toBe(200);
  });
});
