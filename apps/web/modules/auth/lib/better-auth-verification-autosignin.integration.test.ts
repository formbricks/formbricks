import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { runWithEmailVerificationRequestContext } from "@/modules/auth/lib/email-verification-request-context";
import { SIGNUP_INTENT_COOKIE_NAME, createSignupIntentToken } from "@/modules/auth/lib/signup-intent";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { sendVerificationLinkEmail } from "@/modules/email";

// Spy the audit queue so the signedIn trail can be asserted without the real setImmediate/headers()
// emission (which has no request scope under vitest).
vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>()),
  queueAuditEventBackground: vi.fn().mockResolvedValue(undefined),
}));

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
const verifyEmail = async (token: string, intentCookieValue?: string): Promise<Response> => {
  const headers = new Headers();
  if (intentCookieValue) {
    headers.set("cookie", `${SIGNUP_INTENT_COOKIE_NAME}=${intentCookieValue}`);
  }

  return await runWithEmailVerificationRequestContext(async () => {
    // asResponse so the thrown redirect on the withheld path is returned rather than propagated —
    // and so the response's status, Location and set-cookie headers can be asserted, not just DB rows.
    return await auth.api.verifyEmail({ query: { token }, headers, asResponse: true });
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
    const response = await verifyEmail(token);

    // The address is verified — that part is correct and unchanged.
    expect((await prisma.user.findUnique({ where: { email: VICTIM } }))?.emailVerified).toBe(true);
    // But no session exists, so the victim is never signed into the attacker's account. Before this
    // fix this count was 1, and that session is the whole vulnerability.
    expect(await prisma.session.count()).toBe(0);
    // At the HTTP layer too: no session cookie on the response, and the user is not silently bounced —
    // they land on the login page with the "verified, now sign in" explanation.
    expect(response.headers.get("set-cookie") ?? "").not.toContain("session_token=");
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get("location")).toContain("/auth/login?verified=1");
  });

  test("mints the session when the intent cookie names the just-verified user", async () => {
    const { token, userId } = await signUpAndCaptureToken();

    // Same browser that signed up: the ENG-1746 land-in-the-app UX this fix is careful to preserve.
    const response = await verifyEmail(token, createSignupIntentToken(userId));

    expect(await prisma.session.count()).toBe(1);
    const session = await prisma.session.findFirst();
    expect(session?.userId).toBe(userId);
    // The session must reach the BROWSER, not just the database — a row without a set-cookie would
    // leave the user signed out while this table reports success.
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("session_token=");
    // And the spent intent cookie is cleared (single use), on the same response.
    expect(setCookie).toContain(`${SIGNUP_INTENT_COOKIE_NAME}=;`);
    // The signedIn audit trail must survive the move: this session is now minted by our after-hook
    // rather than by autoSignInAfterVerification, and losing the event would be a silent hole in the
    // sign-in audit rather than a visible failure.
    expect(queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "signedIn",
        userId,
        newObject: expect.objectContaining({ authMethod: "password" }),
      })
    );
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
