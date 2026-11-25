import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { GET as completionGet, POST as completionPost } from "@/app/api/auth/sso/recovery/complete/route";
import { resetDb } from "@/integration/reset-db";
import { WEBAPP_URL } from "@/lib/constants";
import { createToken } from "@/lib/jwt";
import { auth } from "@/modules/auth/lib/auth";
import { getSession } from "@/modules/auth/lib/session";
import { ssoRecoveryAfterHandler } from "@/modules/ee/sso/lib/better-auth-hooks";
import { cancelSsoRecovery } from "@/modules/ee/sso/lib/recovery-authorize";
import { getSsoRecoveryFailureRedirectUrl } from "@/modules/ee/sso/lib/recovery-outcomes";
import { SSO_RECOVERY_PROOF_COOKIE_NAME } from "@/modules/ee/sso/lib/recovery-proof";
import { completeSsoRecovery } from "@/modules/ee/sso/lib/sso-recovery";
import { captureSsoIdentity, runWithSsoRequestContext } from "@/modules/ee/sso/lib/sso-request-context";
import { cookieHeaderFrom, proofCookieOf } from "@/modules/ee/sso/lib/tests/recovery-cookies";

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

const mocks = vi.hoisted(() => ({ getOAuthState: vi.fn(), cookieHeader: { value: "" } }));

// The route reads its session through `next/headers`, which only a Next request can supply. The test
// resolves it through Better Auth itself from the cookie its browser is sending, so it stays real.
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));

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
const makeCollisionCtx = (redirect: (url: string) => Error, providerId: string) => ({
  path: "/callback/:providerId",
  params: { providerId },
  context: {
    responseHeaders: new Headers({ location: `${WEBAPP_URL}/auth/login?error=account_not_linked` }),
  },
  redirect,
});

/** One turn of the loop. Returns where the handler redirected the browser. */
const runOneRecoveryAttempt = async (
  callbackUrl: string,
  providerAccountId: string,
  providerId = "google"
): Promise<string> => {
  mocks.getOAuthState.mockResolvedValue({ callbackURL: callbackUrl });

  let redirectedTo = "";
  const redirect = (url: string) => {
    redirectedTo = url;
    return new Error("sso-recovery-redirect");
  };

  await runWithSsoRequestContext(async () => {
    captureSsoIdentity({ email: VICTIM_EMAIL, providerAccountId });
    // The handler signals its redirect by throwing, exactly as Better Auth expects. Matched on the
    // sentinel rather than `toBeDefined()`, so a crash on the way there cannot read as a redirect.
    await expect(ssoRecoveryAfterHandler(makeCollisionCtx(redirect, providerId) as never)).rejects.toThrow(
      "sso-recovery-redirect"
    );
  });

  expect(redirectedTo).toContain("/auth/verification-requested");
  return redirectedTo;
};

/** Opens the link `startSsoRecovery` mails, as the mailbox owner's browser would (ENG-7310). */
const openEmailedRecoveryLink = (userId: string, completionUrl: string): Promise<Response> =>
  auth.api.ssoRecoverySignIn({
    query: {
      // Bound to the recovery it was mailed for, as `startSsoRecovery` mints it.
      token: createToken(userId, {
        purpose: "sso_recovery",
        ssoRecoveryStateId: new URL(completionUrl).searchParams.get("state") ?? undefined,
      }),
      callbackUrl: completionUrl,
    },
    asResponse: true,
  });

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

  /**
   * The ticket was reported against Microsoft, but nothing on this path is provider-specific:
   * `ssoRecoveryAfterHandler` fires for any id `normalizeSsoProvider` accepts, and `startSsoRecovery`
   * carries `provider` as data without branching on it. So every configured provider grew the URL the
   * same way, and every one of them is fixed by the same change. `azure-ad` is in the list because
   * Microsoft can arrive under either spelling — the normaliser maps the legacy alias to `azuread`.
   */
  test.each(["google", "github", "azuread", "azure-ad", "openid", "saml"])(
    "the loop is flat for %s too, not just the provider it was reported against",
    async (providerId) => {
      await seedUser();

      let callbackUrl = `${WEBAPP_URL}/organizations/org_loop/workspaces/ws_loop/surveys`;
      const lengths: number[] = [];

      for (let attempt = 0; attempt < 3; attempt++) {
        const verificationRequestedUrl = await runOneRecoveryAttempt(
          callbackUrl,
          `${providerId}-sub-${attempt}`,
          providerId
        );
        const completionUrl = new URL(verificationRequestedUrl).searchParams.get("callbackUrl")!;

        lengths.push(completionUrl.length);
        expect(loginRequestLineFor(verificationRequestedUrl).length).toBeLessThan(NGINX_REQUEST_LINE_LIMIT);
        callbackUrl = completionUrl;
      }

      expect(new Set(lengths).size).toBe(1);
    }
  );

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

    // The browser that STARTED recovery holds the completion URL, but only the one that opens the
    // emailed link holds a proof, so the URL alone completes nothing, even in the user's own signed-in
    // browser (ENG-7310). The intent survives for the real link.
    await expect(completeSsoRecovery({ stateId, sessionUserId: user.id })).rejects.toThrow(
      "OAuthAccountNotLinked"
    );
    await expect(readSsoRecoveryIntent(stateId)).resolves.not.toBeNull();
    expect(await prisma.account.count({ where: { userId: user.id, provider: "google" } })).toBe(0);

    // The emailed link, opened through the real Better Auth endpoint, mints the proof.
    const recoveryProof = proofCookieOf(await openEmailedRecoveryLink(user.id, completionUrl)) ?? undefined;
    expect(recoveryProof).toBeTruthy();
    const landedOn = await completeSsoRecovery({ stateId, recoveryProof, sessionUserId: user.id });

    expect(landedOn).toBe(destination);
    await expect(readSsoRecoveryIntent(stateId)).resolves.toBeNull();

    const account = await prisma.account.findFirst({ where: { userId: user.id, provider: "google" } });
    expect(account?.providerAccountId).toBe("google-sub-complete");

    // Replaying the spent state must not relink.
    await expect(completeSsoRecovery({ stateId, recoveryProof, sessionUserId: user.id })).rejects.toThrow(
      "OAuthAccountNotLinked"
    );
  });

  /**
   * ENG-7310 and ENG-7395 through the real pieces end to end: the hook starts recovery, the emailed link
   * goes through Better Auth's endpoint, and the route reads what that endpoint set. A cookie the
   * endpoint names one way and the route reads another fails here, which no mocked layer can show.
   */
  test("the emailed link, the GET and the confirmed POST link the identity through the real route", async () => {
    const user = await seedUser();
    const destination = `${WEBAPP_URL}/organizations/org_loop/workspaces/ws_loop/surveys`;
    const verificationRequestedUrl = await runOneRecoveryAttempt(destination, "google-sub-route");
    const completionUrl = new URL(verificationRequestedUrl).searchParams.get("callbackUrl")!;
    const stateId = new URL(completionUrl).searchParams.get("state")!;
    vi.mocked(getSession).mockImplementation(async () => {
      const result = await auth.api.getSession({
        headers: new Headers({ cookie: mocks.cookieHeader.value }),
      });
      return (result ? { user: result.user, session: result.session } : null) as never;
    });

    // The mailbox owner's browser opens the link: a session and a proof come back, then the completion URL.
    const signIn = await openEmailedRecoveryLink(user.id, completionUrl);
    expect(signIn.headers.get("location")).toBe(completionUrl);
    const browserCookies = cookieHeaderFrom(signIn);
    expect(browserCookies).toContain(`${SSO_RECOVERY_PROOF_COOKIE_NAME}=`);

    // The GET it lands on links nothing; it only forwards to the confirmation page.
    const get = await completionGet(new Request(completionUrl, { headers: { cookie: browserCookies } }));
    expect(get.headers.get("location")).toBe(`${WEBAPP_URL}/sso-recovery/confirm?state=${stateId}`);
    expect(await prisma.account.count({ where: { userId: user.id, provider: "google" } })).toBe(0);

    const post = (cookie: string) => {
      mocks.cookieHeader.value = cookie;
      return completionPost(
        new Request(`${WEBAPP_URL}/api/auth/sso/recovery/complete`, {
          method: "POST",
          headers: {
            cookie,
            "content-type": "application/x-www-form-urlencoded",
            "sec-fetch-site": "same-origin",
            "sec-fetch-mode": "navigate",
            "sec-fetch-dest": "document",
            "sec-fetch-user": "?1",
            origin: new URL(WEBAPP_URL).origin,
          },
          body: new URLSearchParams({ state: stateId, action: "link" }).toString(),
        })
      );
    };

    // The same session without the proof (the ENG-7310 attack) is refused, and the intent survives.
    const sessionOnly = browserCookies
      .split("; ")
      .filter((pair) => !pair.startsWith(`${SSO_RECOVERY_PROOF_COOKIE_NAME}=`))
      .join("; ");
    const refused = await post(sessionOnly);
    expect(refused.headers.get("location")).toContain("error=sso_recovery_link_not_opened");
    expect(await prisma.account.count({ where: { userId: user.id, provider: "google" } })).toBe(0);

    // The confirmed POST from the browser that opened the link links it.
    const confirmed = await post(browserCookies);
    expect(confirmed.status).toBe(303);
    expect(confirmed.headers.get("location")).toBe(destination);
    const account = await prisma.account.findFirst({ where: { userId: user.id, provider: "google" } });
    expect(account?.providerAccountId).toBe("google-sub-route");
  });

  /**
   * ENG-7422, as reported: once the recovery is linked or cancelled, the mailed link is spent. Another
   * browser opening the same link (a forwarded mail, a scanner's log, a shared machine's history) gets
   * the recovery failure page and no session. Opening it again while the recovery is live still works,
   * because mail scanners fetch the link before the person does.
   */
  test.each([
    ["linked", completeSsoRecovery],
    ["cancelled", cancelSsoRecovery],
  ] as const)("the emailed link signs nobody in once the recovery is %s", async (_label, finish) => {
    const user = await seedUser();
    const verificationRequestedUrl = await runOneRecoveryAttempt(WEBAPP_URL, "google-sub-replay");
    const completionUrl = new URL(verificationRequestedUrl).searchParams.get("callbackUrl")!;
    const stateId = new URL(completionUrl).searchParams.get("state")!;

    // A scanner's fetch, then the person's click: both land while the recovery is live.
    await openEmailedRecoveryLink(user.id, completionUrl);
    const recoveryProof = proofCookieOf(await openEmailedRecoveryLink(user.id, completionUrl));
    expect(recoveryProof).not.toBeNull();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);

    await finish({ stateId, recoveryProof: recoveryProof ?? undefined, sessionUserId: user.id });

    const replay = await openEmailedRecoveryLink(user.id, completionUrl);

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);
    expect(replay.headers.getSetCookie().some((cookie) => cookie.includes("session_token"))).toBe(false);
    expect(proofCookieOf(replay)).toBeNull();
    expect(replay.headers.get("location")).toBe(getSsoRecoveryFailureRedirectUrl(completionUrl));
  });

  /**
   * Link and Cancel clicked together, against real Postgres and Redis. Exactly one acts: either the
   * identity is linked and the cancel is refused, or the cancel spends the recovery and nothing links.
   * Never both, which is what authorizing first and writing after used to allow.
   */
  test("a Link and a Cancel racing on one recovery: exactly one acts", async () => {
    for (let round = 0; round < 5; round++) {
      await resetDb();
      const user = await seedUser();
      const verificationRequestedUrl = await runOneRecoveryAttempt(WEBAPP_URL, `google-sub-race-${round}`);
      const completionUrl = new URL(verificationRequestedUrl).searchParams.get("callbackUrl")!;
      const stateId = new URL(completionUrl).searchParams.get("state")!;
      const recoveryProof = proofCookieOf(await openEmailedRecoveryLink(user.id, completionUrl)) ?? undefined;
      const args = { stateId, recoveryProof, sessionUserId: user.id };

      const [link, cancel] = await Promise.allSettled([completeSsoRecovery(args), cancelSsoRecovery(args)]);
      const linked = await prisma.account.count({ where: { userId: user.id, provider: "google" } });

      expect([link.status, cancel.status].filter((status) => status === "fulfilled")).toHaveLength(1);
      expect(linked).toBe(link.status === "fulfilled" ? 1 : 0);
    }
  });
});
