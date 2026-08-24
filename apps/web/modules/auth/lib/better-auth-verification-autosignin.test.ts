import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionFromCtx: vi.fn(),
  setSessionCookie: vi.fn(),
  getJustVerifiedUserId: vi.fn(),
  readSignupIntentUserId: vi.fn(),
}));

vi.mock("better-auth/api", () => ({ getSessionFromCtx: mocks.getSessionFromCtx }));
vi.mock("better-auth/cookies", () => ({ setSessionCookie: mocks.setSessionCookie }));
vi.mock("./email-verification-request-context", () => ({
  getJustVerifiedUserId: mocks.getJustVerifiedUserId,
}));
vi.mock("./signup-intent", () => ({
  SIGNUP_INTENT_COOKIE_NAME: "formbricks.signup_intent",
  readSignupIntentUserId: mocks.readSignupIntentUserId,
}));
vi.mock("@formbricks/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { verificationAutoSignInAfterHandler } = await import("./better-auth-verification-autosignin");

const VERIFIED_USER = { id: "user_1", email: "victim@example.com" };

const buildCtx = (overrides: Record<string, unknown> = {}) => {
  const findUserById = vi.fn().mockResolvedValue(VERIFIED_USER);
  const createSession = vi.fn().mockResolvedValue({ token: "session-token" });

  return {
    path: "/verify-email",
    getCookie: vi.fn().mockReturnValue("intent-cookie"),
    setCookie: vi.fn(),
    context: { internalAdapter: { findUserById, createSession } },
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
    mocks.readSignupIntentUserId.mockReturnValue(VERIFIED_USER.id);
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
    mocks.readSignupIntentUserId.mockReturnValue(null);
    const ctx = buildCtx();

    await verificationAutoSignInAfterHandler(ctx);

    expect(sessionOf(ctx)).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  test("withholds the session when the intent cookie names a different user", async () => {
    // The pre-hijacking case with a stale cookie in the mix: proof of signing up for account A must not
    // buy a session on account B.
    mocks.readSignupIntentUserId.mockReturnValue("user_other");
    const ctx = buildCtx();

    await verificationAutoSignInAfterHandler(ctx);

    expect(sessionOf(ctx)).not.toHaveBeenCalled();
  });

  test("does nothing when this request did not verify anyone", async () => {
    // A replay of an already-verified link: Better Auth returns before `afterEmailVerification`, so no
    // marker is set and a still-valid intent cookie must not be spent.
    mocks.getJustVerifiedUserId.mockReturnValue(undefined);
    const ctx = buildCtx();

    await verificationAutoSignInAfterHandler(ctx);

    expect(sessionOf(ctx)).not.toHaveBeenCalled();
    expect(mocks.readSignupIntentUserId).not.toHaveBeenCalled();
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

    await expect(verificationAutoSignInAfterHandler(ctx)).resolves.toBeUndefined();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  test("withholds rather than throwing when the verified user cannot be loaded", async () => {
    const ctx = buildCtx();
    (
      ctx as unknown as { context: { internalAdapter: { findUserById: ReturnType<typeof vi.fn> } } }
    ).context.internalAdapter.findUserById.mockResolvedValue(null);

    await expect(verificationAutoSignInAfterHandler(ctx)).resolves.toBeUndefined();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });
});
