import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the Better Auth instance so the test never loads the real auth.ts graph (Redis/prisma/etc.).
const { getSessionMock, findUniqueMock, warnMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  findUniqueMock: vi.fn(),
  warnMock: vi.fn(),
}));

vi.mock("@/modules/auth/lib/auth", () => ({
  auth: { api: { getSession: getSessionMock } },
}));

vi.mock("@formbricks/database", () => ({
  prisma: { session: { findUnique: findUniqueMock } },
}));

vi.mock("@formbricks/logger", () => ({
  logger: { warn: warnMock },
}));

// `next/headers` and `server-only` are stubbed globally in vitestSetup; the mocked
// `auth.api.getSession` ignores the headers arg, so the stub's value is irrelevant here.

// Re-import per test (fresh React `cache()`) so the memoized DAL can't leak results across cases.
const importGetSession = async () => (await import("./session")).getSession;

const USER = { id: "user_abc123", email: "user@example.com", name: "Ada Lovelace" };
const baSession = (expiresAt: Date | string = new Date("2026-07-01T00:00:00.000Z")) => ({
  session: { expiresAt, token: "session_token_1", userId: USER.id },
  user: { ...USER, emailVerified: true },
});

describe("getSession — Better Auth DAL (ENG-1054)", () => {
  beforeEach(() => {
    vi.resetModules();
    getSessionMock.mockReset();
    findUniqueMock.mockReset();
    warnMock.mockReset();
    findUniqueMock.mockResolvedValue({ userId: USER.id, user: { isActive: true } });
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
    getSessionMock.mockResolvedValue(baSession());
    const getSession = await importGetSession();
    await expect(getSession()).resolves.toEqual({
      user: USER,
      expires: "2026-07-01T00:00:00.000Z",
    });
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { sessionToken: "session_token_1" },
      select: { userId: true, user: { select: { isActive: true } } },
    });
  });

  test("normalizes a serialized (string) expiresAt to an ISO string", async () => {
    getSessionMock.mockResolvedValue(baSession("2026-07-01T00:00:00.000Z"));
    const getSession = await importGetSession();
    await expect(getSession()).resolves.toMatchObject({ expires: "2026-07-01T00:00:00.000Z" });
  });

  // Regression: `rejectInactiveUserOnSessionCreate` only gates session creation, and Better Auth
  // serves the user from Redis + a 5-minute cookie cache — so without a live read a user deactivated
  // after signing in kept full access for the life of a rolling 1-day session.
  test("returns null when the user has been deactivated since signing in", async () => {
    getSessionMock.mockResolvedValue(baSession());
    findUniqueMock.mockResolvedValue({ userId: USER.id, user: { isActive: false } });

    const getSession = await importGetSession();
    await expect(getSession()).resolves.toBeNull();
  });

  // ENG-3418: Redis outlived the Postgres row (a user-delete cascade, a bare deleteMany, a restore), so
  // Better Auth still serves the session. The row is the authority.
  test("returns null when Better Auth serves a session whose database row is gone", async () => {
    getSessionMock.mockResolvedValue(baSession());
    findUniqueMock.mockResolvedValue(null);

    const getSession = await importGetSession();
    await expect(getSession()).resolves.toBeNull();
  });

  test("returns null when the session row belongs to a different user", async () => {
    getSessionMock.mockResolvedValue(baSession());
    findUniqueMock.mockResolvedValue({ userId: "someone_else", user: { isActive: true } });

    const getSession = await importGetSession();
    await expect(getSession()).resolves.toBeNull();
  });

  // ENG-3418: refreshing a Redis-served session whose row is gone makes Better Auth throw this 401
  // instead of returning null. Uncaught, it crashed the page rather than redirecting to login.
  test("returns null when Better Auth throws its vanished-session 401", async () => {
    getSessionMock.mockRejectedValue(
      APIError.from("UNAUTHORIZED", { code: "FAILED_TO_GET_SESSION", message: "Failed to get session" })
    );

    const getSession = await importGetSession();
    await expect(getSession()).resolves.toBeNull();
    expect(warnMock).toHaveBeenCalledOnce();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  test("still throws when Better Auth fails for any other reason", async () => {
    const outage = APIError.from("INTERNAL_SERVER_ERROR", {
      code: "FAILED_TO_GET_SESSION",
      message: "Failed to get session",
    });
    getSessionMock.mockRejectedValue(outage);

    const getSession = await importGetSession();
    await expect(getSession()).rejects.toBe(outage);
  });
});
