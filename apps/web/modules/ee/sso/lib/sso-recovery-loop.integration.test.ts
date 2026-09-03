import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { WEBAPP_URL } from "@/lib/constants";
import { ssoRecoveryAfterHandler } from "@/modules/ee/sso/lib/better-auth-hooks";
import { completeSsoRecovery } from "@/modules/ee/sso/lib/sso-recovery";
import { captureSsoIdentity, runWithSsoRequestContext } from "@/modules/ee/sso/lib/sso-request-context";

/**
 * ENG-2783 end to end, through the hook the IdP callback actually runs, against real Postgres and real
 * Redis.
 *
 * The unit growth test proves the arithmetic; this proves the wiring. It starts one level above
 * `startSsoRecovery` — at `ssoRecoveryAfterHandler`, the Better Auth `hooks.after` middleware that turns
 * an `error=account_not_linked` callback into recovery — so the callback URL it works from is the one
 * Better Auth really hands over, and the intent really lands in Redis. Only `getOAuthState` is stubbed,
 * because reading it needs a live Better Auth request context that no test can supply; every other
 * participant is real.
 *
 * The loop under test is the one from the ticket: the completion URL becomes the `callbackUrl` on the
 * verification-requested page, whose log-in link hands it to `/auth/login`, and signing in with the same
 * IdP re-enters this handler carrying it. On the JWT implementation each turn multiplied the URL by
 * ~2.7 (hex-encoded ciphertext, then base64url) and the third produced a bare 414.
 */

const mocks = vi.hoisted(() => ({ getOAuthState: vi.fn() }));

// The one stub. `APIError` and `createAuthMiddleware` from the same module stay real.
vi.mock("better-auth/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("better-auth/api")>()),
  getOAuthState: mocks.getOAuthState,
}));

// Fires inside setImmediate and calls getClientIpFromHeaders() outside a request scope.
vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>()),
  queueAuditEventBackground: vi.fn(async () => undefined),
}));

/** nginx's `large_client_header_buffers` defaults to `4 8k`, and a request line must fit ONE buffer. */
const NGINX_REQUEST_LINE_LIMIT = 8192;
const VICTIM_EMAIL = "loop@example.com";

const seedUser = () =>
  prisma.user.create({
    data: { email: VICTIM_EMAIL, name: "Loop Tester", emailVerified: true, locale: "en-US" },
  });

/** The Better Auth endpoint context for an SSO callback that collided with an existing account. */
const makeCollisionCtx = (redirect: (url: string) => Error) => ({
  path: "/callback/:providerId",
  params: { providerId: "google" },
  context: {
    responseHeaders: new Headers({ location: `${WEBAPP_URL}/auth/login?error=account_not_linked` }),
  },
  redirect,
});

/** One turn of the loop. Returns where the handler redirected the browser. */
const runOneRecoveryAttempt = async (callbackUrl: string, providerAccountId: string): Promise<string> => {
  mocks.getOAuthState.mockResolvedValue({ callbackURL: callbackUrl });

  let redirectedTo = "";
  const redirect = (url: string) => {
    redirectedTo = url;
    return new Error("redirect");
  };

  await runWithSsoRequestContext(async () => {
    captureSsoIdentity({ email: VICTIM_EMAIL, providerAccountId });
    // The handler signals its redirect by throwing, exactly as Better Auth expects.
    await expect(ssoRecoveryAfterHandler(makeCollisionCtx(redirect) as never)).rejects.toBeDefined();
  });

  expect(redirectedTo).toContain("/auth/verification-requested");
  return redirectedTo;
};

/** What the browser sends when the user clicks "log in" on the verification-requested page. */
const loginRequestLineFor = (verificationRequestedUrl: string): string => {
  const callbackUrl = new URL(verificationRequestedUrl).searchParams.get("callbackUrl") ?? "";
  return `GET /auth/login?callbackUrl=${encodeURIComponent(callbackUrl)} HTTP/1.1`;
};

describe("SSO recovery retry loop (real Postgres + Redis, real Better Auth hook)", () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
  });

  test("four trips round the loop leave every URL the same length, well inside nginx's buffer", async () => {
    await seedUser();

    let callbackUrl = `${WEBAPP_URL}/organizations/org_loop/workspaces/ws_loop/surveys`;
    const lengths: number[] = [];
    const stateIds: string[] = [];

    for (let attempt = 0; attempt < 4; attempt++) {
      const verificationRequestedUrl = await runOneRecoveryAttempt(callbackUrl, `google-sub-${attempt}`);
      const completionUrl = new URL(verificationRequestedUrl).searchParams.get("callbackUrl")!;

      lengths.push(completionUrl.length);
      stateIds.push(new URL(completionUrl).searchParams.get("state")!);
      expect(loginRequestLineFor(verificationRequestedUrl).length).toBeLessThan(NGINX_REQUEST_LINE_LIMIT);

      // Round again with what the log-in link carries — the step that used to nest.
      callbackUrl = completionUrl;
    }

    expect(new Set(lengths).size).toBe(1);
    // Every attempt gets its own record; none is reused or overwritten.
    expect(new Set(stateIds).size).toBe(4);
    stateIds.forEach((stateId) => expect(stateId).toMatch(/^[A-Za-z0-9_-]{43}$/));
  });

  test("a recovery callback arriving as the next attempt's destination is dropped, not stored", async () => {
    await seedUser();
    const { readSsoRecoveryIntent } = await import("@/modules/ee/sso/lib/recovery-intent");

    const originalDestination = `${WEBAPP_URL}/organizations/org_loop/workspaces/ws_loop/surveys`;
    const first = await runOneRecoveryAttempt(originalDestination, "google-sub-a");
    const firstCompletionUrl = new URL(first).searchParams.get("callbackUrl")!;

    const second = await runOneRecoveryAttempt(firstCompletionUrl, "google-sub-b");
    const secondCompletionUrl = new URL(second).searchParams.get("callbackUrl")!;

    const firstIntent = await readSsoRecoveryIntent(new URL(firstCompletionUrl).searchParams.get("state"));
    const secondIntent = await readSsoRecoveryIntent(new URL(secondCompletionUrl).searchParams.get("state"));

    expect(firstIntent?.callbackUrl).toBe(originalDestination);
    // Round two arrived pointing back into recovery, so it falls back rather than nesting.
    expect(secondIntent?.callbackUrl).toBe(WEBAPP_URL);
  });

  test("the intent minted by the hook completes and is then spent", async () => {
    const user = await seedUser();
    const { readSsoRecoveryIntent } = await import("@/modules/ee/sso/lib/recovery-intent");

    const destination = `${WEBAPP_URL}/organizations/org_loop/workspaces/ws_loop/surveys`;
    const verificationRequestedUrl = await runOneRecoveryAttempt(destination, "google-sub-complete");
    const completionUrl = new URL(verificationRequestedUrl).searchParams.get("callbackUrl")!;
    const stateId = new URL(completionUrl).searchParams.get("state")!;

    const landedOn = await completeSsoRecovery({ stateId, sessionUserId: user.id });

    expect(landedOn).toBe(destination);
    await expect(readSsoRecoveryIntent(stateId)).resolves.toBeNull();

    const account = await prisma.account.findFirst({ where: { userId: user.id, provider: "google" } });
    expect(account?.providerAccountId).toBe("google-sub-complete");

    // Replaying the spent state must not relink.
    await expect(completeSsoRecovery({ stateId, sessionUserId: user.id })).rejects.toThrow(
      "OAuthAccountNotLinked"
    );
  });
});
