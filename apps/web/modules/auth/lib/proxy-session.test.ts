import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getProxySession, getSessionTokenFromRequest } from "./proxy-session";

const { TEST_SECRET, mockFindUnique } = vi.hoisted(() => ({
  TEST_SECRET: "proxy-session-test-secret-at-least-32-characters",
  mockFindUnique: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    session: {
      findUnique: mockFindUnique,
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: { BETTER_AUTH_SECRET: TEST_SECRET },
}));

// Mirror better-call's serializeSignedCookie: `${token}.${base64(HMAC-SHA256(token, secret))}`.
const sign = (token: string, secret = TEST_SECRET): string =>
  `${token}.${createHmac("sha256", secret).update(token).digest("base64")}`;

const SELECT = {
  userId: true,
  expires: true,
  user: { select: { isActive: true } },
};

const createRequest = (cookies: Record<string, string> = {}) => ({
  cookies: {
    get: (name: string) => {
      const value = cookies[name];
      return value ? { value } : undefined;
    },
  },
});

describe("proxy-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("extracts the verified session token from a signed Better Auth cookie", () => {
    const request = createRequest({ "__Secure-formbricks.session_token": sign("secure-token") });
    expect(getSessionTokenFromRequest(request)).toBe("secure-token");
  });

  test("rejects a tampered cookie signature without hitting the database", async () => {
    const request = createRequest({
      "__Secure-formbricks.session_token": "valid-token.not-a-valid-signature",
    });
    expect(getSessionTokenFromRequest(request)).toBeNull();
    expect(await getProxySession(request)).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  test("returns null when no session cookie is present", async () => {
    const session = await getProxySession(createRequest());
    expect(session).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  test("returns null when the session is expired", async () => {
    mockFindUnique.mockResolvedValue({
      userId: "user-1",
      expires: new Date(Date.now() - 60_000),
      user: { isActive: true },
    });

    const request = createRequest({ "formbricks.session_token": sign("expired-token") });
    const session = await getProxySession(request);

    expect(session).toBeNull();
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { sessionToken: "expired-token" }, select: SELECT });
  });

  test("returns null when the session belongs to an inactive user", async () => {
    mockFindUnique.mockResolvedValue({
      userId: "user-1",
      expires: new Date(Date.now() + 60_000),
      user: { isActive: false },
    });

    const request = createRequest({ "formbricks.session_token": sign("inactive-user-token") });
    expect(await getProxySession(request)).toBeNull();
  });

  test("returns the session when the signed cookie maps to a valid session", async () => {
    const validSession = {
      userId: "user-1",
      expires: new Date(Date.now() + 60_000),
      user: { isActive: true },
    };
    mockFindUnique.mockResolvedValue(validSession);

    const request = createRequest({ "__Secure-formbricks.session_token": sign("valid-token") });
    const session = await getProxySession(request);

    expect(session).toEqual(validSession);
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { sessionToken: "valid-token" }, select: SELECT });
  });
});
