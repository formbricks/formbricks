import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the Better Auth instance so the test never loads the real auth.ts graph (Redis/prisma/etc.).
const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));

vi.mock("@/modules/auth/lib/auth", () => ({
  auth: { api: { getSession: getSessionMock } },
}));

// `next/headers` and `server-only` are stubbed globally in vitestSetup; the mocked
// `auth.api.getSession` ignores the headers arg, so the stub's value is irrelevant here.

// Re-import per test (fresh React `cache()`) so the memoized DAL can't leak results across cases.
const importGetSession = async () => (await import("./session")).getSession;

describe("getSession — Better Auth DAL (ENG-1054)", () => {
  beforeEach(() => {
    vi.resetModules();
    getSessionMock.mockReset();
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
});
