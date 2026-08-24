import { beforeEach, describe, expect, test, vi } from "vitest";
import { getSessionTokensByUserId } from "@/modules/auth/lib/auth-session-repository";
import { revokeUserSessionsExcept } from "@/modules/auth/lib/session-revocation";

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
