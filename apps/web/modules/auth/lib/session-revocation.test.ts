import { beforeEach, describe, expect, test, vi } from "vitest";
import { getSessionTokensByUserId } from "@/modules/auth/lib/auth-session-repository";
import { revokeSessionByToken, revokeUserSessionsExcept } from "@/modules/auth/lib/session-revocation";

const mocks = vi.hoisted(() => ({
  deleteSessions: vi.fn(),
}));

vi.mock("@/modules/auth/lib/auth-session-repository", () => ({
  getSessionTokensByUserId: vi.fn(),
}));

vi.mock("@/modules/auth/lib/auth", () => ({
  auth: {
    $context: Promise.resolve({
      internalAdapter: { deleteSessions: mocks.deleteSessions },
    }),
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

describe("revokeUserSessionsExcept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteSessions.mockResolvedValue(undefined);
  });

  /**
   * The whole point of this helper: sessions live in Postgres AND Redis, and `findSession` reads Redis
   * first. Going through Better Auth's `deleteSessions` is what clears both — a bare Prisma delete would
   * leave every revoked session still resolvable by `auth.api.getSession`.
   */
  test("revokes through Better Auth's adapter, so both session stores are cleared", async () => {
    vi.mocked(getSessionTokensByUserId).mockResolvedValue(["token-a", "token-b"]);

    const revoked = await revokeUserSessionsExcept({ userId: "user_1" });

    expect(mocks.deleteSessions).toHaveBeenCalledWith(["token-a", "token-b"]);
    expect(revoked).toBe(2);
  });

  test("spares the caller's own session", async () => {
    vi.mocked(getSessionTokensByUserId).mockResolvedValue(["token-a", "keep-me", "token-b"]);

    const revoked = await revokeUserSessionsExcept({ userId: "user_1", keepSessionToken: "keep-me" });

    expect(mocks.deleteSessions).toHaveBeenCalledWith(["token-a", "token-b"]);
    expect(revoked).toBe(2);
  });

  test("does not touch the adapter when the only session is the one being kept", async () => {
    vi.mocked(getSessionTokensByUserId).mockResolvedValue(["keep-me"]);

    const revoked = await revokeUserSessionsExcept({ userId: "user_1", keepSessionToken: "keep-me" });

    expect(mocks.deleteSessions).not.toHaveBeenCalled();
    expect(revoked).toBe(0);
  });

  /**
   * Fail-safe direction: `keepSessionToken` is only ever SUBTRACTED from the user's own token set, so an
   * absent or foreign value can only over-revoke the caller's sessions — never under-revoke, and never
   * reach another user. These two pin that, because the opposite would be a real hole.
   */
  test("sweeps the caller too when no token is supplied", async () => {
    vi.mocked(getSessionTokensByUserId).mockResolvedValue(["token-a", "token-b"]);

    const revoked = await revokeUserSessionsExcept({ userId: "user_1", keepSessionToken: undefined });

    expect(mocks.deleteSessions).toHaveBeenCalledWith(["token-a", "token-b"]);
    expect(revoked).toBe(2);
  });

  test("a token belonging to someone else spares nothing and reaches nothing", async () => {
    vi.mocked(getSessionTokensByUserId).mockResolvedValue(["token-a", "token-b"]);

    const revoked = await revokeUserSessionsExcept({
      userId: "user_1",
      keepSessionToken: "some-other-users-token",
    });

    // Everything of user_1's goes; the foreign token is never passed to the adapter.
    expect(mocks.deleteSessions).toHaveBeenCalledWith(["token-a", "token-b"]);
    expect(revoked).toBe(2);
  });

  test("is a no-op for a user with no sessions", async () => {
    vi.mocked(getSessionTokensByUserId).mockResolvedValue([]);

    expect(await revokeUserSessionsExcept({ userId: "user_1" })).toBe(0);
    expect(mocks.deleteSessions).not.toHaveBeenCalled();
  });

  test("enumerates from Postgres, which is the store that always has every session", async () => {
    vi.mocked(getSessionTokensByUserId).mockResolvedValue(["token-a"]);

    await revokeUserSessionsExcept({ userId: "user_1" });

    // Not `internalAdapter.listSessions`: under `secondaryStorage` that reads only the
    // `active-sessions-<userId>` Redis index and returns [] if it was evicted, revoking nothing.
    expect(getSessionTokensByUserId).toHaveBeenCalledWith("user_1");
  });
});

describe("revokeSessionByToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteSessions.mockResolvedValue(undefined);
  });

  test("revokes the one session through the adapter, so both stores are cleared", async () => {
    await revokeSessionByToken("token-a");

    expect(mocks.deleteSessions).toHaveBeenCalledWith(["token-a"]);
  });

  // The guard the retired `deleteSessionBySessionToken` carried. An empty token would otherwise reach
  // `secondaryStorage.delete("")` and a `deleteMany` on `token IN ('')` — a no-op that looks like a
  // successful revocation, which is the worst possible failure mode for this function.
  test.each([[""], ["   "]])("refuses a blank token (%j) instead of no-oping", async (token) => {
    await expect(revokeSessionByToken(token)).rejects.toThrow();

    expect(mocks.deleteSessions).not.toHaveBeenCalled();
  });
});
