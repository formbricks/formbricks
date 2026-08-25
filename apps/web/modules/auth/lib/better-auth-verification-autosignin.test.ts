import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionFromCtx: vi.fn(),
  setSessionCookie: vi.fn(),
  getJustVerifiedUserId: vi.fn(),
  classifySignupIntent: vi.fn(),
  auditVerificationSessionWithheld: vi.fn(),
}));

vi.mock("better-auth/api", () => ({ getSessionFromCtx: mocks.getSessionFromCtx }));
vi.mock("better-auth/cookies", () => ({ setSessionCookie: mocks.setSessionCookie }));
vi.mock("./email-verification-request-context", () => ({
  getJustVerifiedUserId: mocks.getJustVerifiedUserId,
}));
vi.mock("./signup-intent", () => ({
  SIGNUP_INTENT_COOKIE_NAME: "formbricks.signup_intent",
  SIGNUP_INTENT_COOKIE_OPTIONS: { httpOnly: true, secure: false, path: "/", sameSite: "lax", maxAge: 3600 },
  classifySignupIntent: mocks.classifySignupIntent,
}));
vi.mock("./better-auth-observability", () => ({
  auditVerificationSessionWithheld: mocks.auditVerificationSessionWithheld,
}));
vi.mock("@/lib/constants", () => ({ WEBAPP_URL: "https://app.formbricks.com" }));
vi.mock("@formbricks/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** What the handler redirects to whenever it withholds the session. */
const LOGIN_VERIFIED = "https://app.formbricks.com/auth/login?verified=1";

const { verificationAutoSignInAfterHandler } = await import("./better-auth-verification-autosignin");

const VERIFIED_USER = { id: "user_1", email: "victim@example.com" };

const buildCtx = (overrides: Record<string, unknown> = {}) => {
  const findUserById = vi.fn().mockResolvedValue(VERIFIED_USER);
  const createSession = vi.fn().mockResolvedValue({ token: "session-token" });

  return {
    path: "/verify-email",
    getCookie: vi.fn().mockReturnValue("intent-cookie"),
    setCookie: vi.fn(),
    // Mirrors Better Auth: `ctx.redirect` RETURNS a value the caller throws.
    redirect: vi.fn((url: string) => new Error(`REDIRECT:${url}`)),
    context: {
      internalAdapter: { findUserById, createSession },
      authCookies: { sessionToken: { name: "formbricks.session_token" } },
      responseHeaders: new Headers(),
    },
    ...overrides,
  } as never;
};

const sessionOf = (ctx: never) =>
  (ctx as unknown as { context: { internalAdapter: { createSession: ReturnType<typeof vi.fn> } } }).context
    .internalAdapter.createSession;

describe("verificationAutoSignInAfterHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getJustVerifiedUserId.mockReturnValue(VERIFIED_USER.id);
    mocks.classifySignupIntent.mockReturnValue("valid");
    mocks.getSessionFromCtx.mockResolvedValue(null);
  });

  test("mints a session when the intent cookie names the verified user", async () => {
    const ctx = buildCtx();

    await verificationAutoSignInAfterHandler(ctx);

    expect(sessionOf(ctx)).toHaveBeenCalledWith(VERIFIED_USER.id, false);
    expect(mocks.setSessionCookie).toHaveBeenCalledOnce();
  });

  test("clears the intent cookie after use, so a replayed link cannot mint a second session", async () => {
    const ctx = buildCtx();

    await verificationAutoSignInAfterHandler(ctx);

    expect((ctx as unknown as { setCookie: ReturnType<typeof vi.fn> }).setCookie).toHaveBeenCalledWith(
      "formbricks.signup_intent",
      "",
      expect.objectContaining({ maxAge: 0 })
    );
  });

  test("withholds the session when there is no intent cookie", async () => {
    mocks.classifySignupIntent.mockReturnValue("absent");
    const ctx = buildCtx();

    await expect(verificationAutoSignInAfterHandler(ctx)).rejects.toThrow(`REDIRECT:${LOGIN_VERIFIED}`);

    expect(sessionOf(ctx)).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    // The withheld path is the observable footprint of an attempted pre-hijack, so it is recorded.
    expect(mocks.auditVerificationSessionWithheld).toHaveBeenCalledWith(VERIFIED_USER.id, "absent");
  });

  test("withholds the session when the intent cookie names a different user", async () => {
    // The pre-hijacking case with a stale cookie in the mix: proof of signing up for account A must not
    // buy a session on account B.
    mocks.classifySignupIntent.mockReturnValue("other_user");
    const ctx = buildCtx();

    await expect(verificationAutoSignInAfterHandler(ctx)).rejects.toThrow(`REDIRECT:${LOGIN_VERIFIED}`);

    expect(sessionOf(ctx)).not.toHaveBeenCalled();
  });

  test("does nothing when this request did not verify anyone", async () => {
    // A replay of an already-verified link: Better Auth returns before `afterEmailVerification`, so no
    // marker is set and a still-valid intent cookie must not be spent.
    mocks.getJustVerifiedUserId.mockReturnValue(undefined);
    const ctx = buildCtx();

    await verificationAutoSignInAfterHandler(ctx);

    expect(sessionOf(ctx)).not.toHaveBeenCalled();
    expect(mocks.classifySignupIntent).not.toHaveBeenCalled();
    // Asserts the marker guard specifically, by pinning that the handler returns before it does any
    // work at all. Without this the row passed even with the guard deleted, because an absent session
    // and an absent marker both read as `undefined` further down and matched each other.
    expect(mocks.getSessionFromCtx).not.toHaveBeenCalled();
  });

  test("ignores endpoints other than /verify-email", async () => {
    const ctx = buildCtx({ path: "/sign-in/email" });

    await verificationAutoSignInAfterHandler(ctx);

    expect(mocks.getJustVerifiedUserId).not.toHaveBeenCalled();
    expect(sessionOf(ctx)).not.toHaveBeenCalled();
  });

  test("leaves an existing session for the same user alone", async () => {
    // EMAIL_VERIFICATION_DISABLED=1 (the shipped self-host default) lets a user sign in before
    // verifying, so verification can arrive already authenticated. Minting again would be pointless;
    // signing them out would be a regression.
    mocks.getSessionFromCtx.mockResolvedValue({ user: { id: VERIFIED_USER.id } });
    const ctx = buildCtx();

    await verificationAutoSignInAfterHandler(ctx);

    expect(sessionOf(ctx)).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  test("defers when the endpoint already attached a session cookie to the response", async () => {
    // Better Auth's `updateTo` email-change branch mints its own session AND fires
    // afterEmailVerification. changeEmail is not enabled today, but if it ever is, this hook must not
    // stomp that flow's response with the login redirect.
    const ctx = buildCtx();
    (ctx as unknown as { context: { responseHeaders: Headers } }).context.responseHeaders.set(
      "set-cookie",
      "formbricks.session_token=abc; Path=/; HttpOnly"
    );

    await verificationAutoSignInAfterHandler(ctx);

    expect(sessionOf(ctx)).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    expect(mocks.auditVerificationSessionWithheld).not.toHaveBeenCalled();
  });

  test("still mints when the session read appends a cookie (not an endpoint grant)", async () => {
    // Pins that the guard asks what the ENDPOINT returned and is not perturbed by anything the session
    // read adds afterwards. Note this scenario is not reachable in production: getSessionFromCtx appends
    // to better-call's `ctx.responseHeaders`, a different Headers instance from the
    // `ctx.context.responseHeaders` the guard reads (verified at runtime), and the two are merged only
    // after this hook returns. Kept as a structural guard on the ordering, not as a regression test for
    // a bug that existed.
    const ctx = buildCtx();
    mocks.getSessionFromCtx.mockImplementation(async () => {
      (ctx as unknown as { context: { responseHeaders: Headers } }).context.responseHeaders.append(
        "set-cookie",
        "formbricks.session_token=refreshed; Path=/; HttpOnly"
      );
      return { user: { id: "someone_else" } };
    });

    await verificationAutoSignInAfterHandler(ctx);

    expect(sessionOf(ctx)).toHaveBeenCalledWith(VERIFIED_USER.id, false);
    expect(mocks.setSessionCookie).toHaveBeenCalledOnce();
  });

  test("still mints when a DIFFERENT user is signed in in this browser", async () => {
    mocks.getSessionFromCtx.mockResolvedValue({ user: { id: "someone_else" } });
    const ctx = buildCtx();

    await verificationAutoSignInAfterHandler(ctx);

    expect(sessionOf(ctx)).toHaveBeenCalledWith(VERIFIED_USER.id, false);
  });

  // The stranding case: `emailVerified` is already committed when this hook runs, so a throw here
  // would 500 a link that verified the user, and the retry hits Better Auth's already-verified early
  // return — which never reaches this hook again.
  test("swallows a failure instead of failing the verification request", async () => {
    const ctx = buildCtx();
    sessionOf(ctx).mockRejectedValue(new Error("adapter exploded"));

    // The adapter error must NOT escape — it is converted into the login redirect. If it propagated,
    // the user would get a 500 on a link that already verified them.
    await expect(verificationAutoSignInAfterHandler(ctx)).rejects.toThrow(`REDIRECT:${LOGIN_VERIFIED}`);
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    // Deliberately NOT audited: this is the catch-all safety net, and an audit write there could throw
    // on its own and escape the very guard that exists to stop a 500 on an already-verified link. The
    // error log is the record for this path. The refused-mint case below is the one that gets audited.
    expect(mocks.auditVerificationSessionWithheld).not.toHaveBeenCalled();
  });

  test("withholds rather than throwing when the verified user cannot be loaded", async () => {
    const ctx = buildCtx();
    (
      ctx as unknown as { context: { internalAdapter: { findUserById: ReturnType<typeof vi.fn> } } }
    ).context.internalAdapter.findUserById.mockResolvedValue(null);

    await expect(verificationAutoSignInAfterHandler(ctx)).rejects.toThrow(`REDIRECT:${LOGIN_VERIFIED}`);
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    // The proof was good and we still granted nothing — the one withheld outcome that is our own fault,
    // so it must not be the only silent one.
    expect(mocks.auditVerificationSessionWithheld).toHaveBeenCalledWith(VERIFIED_USER.id, "grant_failed");
  });

  test("audits the refused session when the inactive-user gate blocks the mint", async () => {
    // `session.create.before` (rejectInactiveUserOnSessionCreate) returns no session for a deactivated
    // user rather than throwing, so this arrives as a falsy createSession, not an exception.
    const ctx = buildCtx();
    sessionOf(ctx).mockResolvedValue(null);

    await expect(verificationAutoSignInAfterHandler(ctx)).rejects.toThrow(`REDIRECT:${LOGIN_VERIFIED}`);
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    expect(mocks.auditVerificationSessionWithheld).toHaveBeenCalledWith(VERIFIED_USER.id, "grant_failed");
  });
});
