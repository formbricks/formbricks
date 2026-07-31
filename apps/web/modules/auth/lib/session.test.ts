import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the Better Auth instance so the test never loads the real auth.ts graph (Redis/prisma/etc.).
const { getSessionMock, findUniqueMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  findUniqueMock: vi.fn(),
}));

vi.mock("@/modules/auth/lib/auth", () => ({
  auth: { api: { getSession: getSessionMock } },
}));

vi.mock("@formbricks/database", () => ({
  prisma: { user: { findUnique: findUniqueMock } },
}));

// `next/headers` and `server-only` are stubbed globally in vitestSetup; the mocked
// `auth.api.getSession` ignores the headers arg, so the stub's value is irrelevant here.

// Re-import per test (fresh React `cache()`) so the memoized DAL can't leak results across cases.
const importGetSession = async () => (await import("./session")).getSession;

describe("getSession — Better Auth DAL (ENG-1054)", () => {
  beforeEach(() => {
    vi.resetModules();
    getSessionMock.mockReset();
    findUniqueMock.mockReset();
    findUniqueMock.mockResolvedValue({ isActive: true });
  });

  test("returns null when Better Auth has no session", async () => {
    getSessionMock.mockResolvedValue(null);
    const getSession = await importGetSession();
    await expect(getSession()).resolves.toBeNull();
  });

  test("returns null when the result carries no user (e.g. a 2FA challenge in flight)", async () => {
    getSessionMock.mockResolvedValue({ session: { expiresAt: new Date() }, user: null });
    const getSession = await importGetSession();
    await expect(getSession()).resolves.toBeNull();
  });

  test("maps the Better Auth session/user onto the augmented NextAuth Session shape", async () => {
    getSessionMock.mockResolvedValue({
      session: { expiresAt: new Date("2026-07-01T00:00:00.000Z"), token: "ignored", userId: "u1" },
      user: { id: "user_abc123", email: "user@example.com", name: "Ada Lovelace", emailVerified: true },
    });
    const getSession = await importGetSession();
    await expect(getSession()).resolves.toEqual({
      user: { id: "user_abc123", email: "user@example.com", name: "Ada Lovelace" },
      expires: "2026-07-01T00:00:00.000Z",
    });
  });

  test("normalizes a serialized (string) expiresAt to an ISO string", async () => {
    getSessionMock.mockResolvedValue({
      session: { expiresAt: "2026-07-01T00:00:00.000Z" },
      user: { id: "u1", email: "u@e.com", name: "U" },
    });
    const getSession = await importGetSession();
    await expect(getSession()).resolves.toMatchObject({ expires: "2026-07-01T00:00:00.000Z" });
  });

  // Regression: `rejectInactiveUserOnSessionCreate` only gates session creation, and Better Auth
  // serves the user from Redis + a 5-minute cookie cache — so without a live read a user deactivated
  // after signing in kept full access for the life of a rolling 1-day session.
  test("returns null when the user has been deactivated since signing in", async () => {
    getSessionMock.mockResolvedValue({
      session: { expiresAt: new Date("2026-07-01T00:00:00.000Z") },
      user: { id: "user_abc123", email: "user@example.com", name: "Ada Lovelace" },
    });
    findUniqueMock.mockResolvedValue({ isActive: false });

    const getSession = await importGetSession();
    await expect(getSession()).resolves.toBeNull();
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: "user_abc123" },
      select: { isActive: true },
    });
  });

  test("returns null when the session's user row no longer exists", async () => {
    getSessionMock.mockResolvedValue({
      session: { expiresAt: new Date("2026-07-01T00:00:00.000Z") },
      user: { id: "deleted_user", email: "gone@example.com", name: "Gone" },
    });
    findUniqueMock.mockResolvedValue(null);

    const getSession = await importGetSession();
    await expect(getSession()).resolves.toBeNull();
  });
});
