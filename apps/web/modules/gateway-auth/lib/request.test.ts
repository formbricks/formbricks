import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { authenticateGatewayRequest } from "./request";

const {
  mockAuthenticateApiKeyFromHeaders,
  mockGetApiKeyFromHeaders,
  mockGetProxySession,
  mockUserFindUnique,
  mockLoggerWarn,
} = vi.hoisted(() => ({
  mockAuthenticateApiKeyFromHeaders: vi.fn(),
  mockGetApiKeyFromHeaders: vi.fn(),
  mockGetProxySession: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

vi.mock("@/modules/api/lib/api-key-auth", () => ({
  authenticateApiKeyFromHeaders: mockAuthenticateApiKeyFromHeaders,
  getApiKeyFromHeaders: mockGetApiKeyFromHeaders,
}));

vi.mock("@/modules/auth/lib/proxy-session", () => ({
  getProxySession: mockGetProxySession,
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
  },
}));

describe("authenticateGatewayRequest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetApiKeyFromHeaders.mockReturnValue(null);
    mockAuthenticateApiKeyFromHeaders.mockResolvedValue(null);
    mockGetProxySession.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue({ id: "user_1", isActive: true });
  });

  test("logs and returns invalid when an explicit API key cannot be authenticated", async () => {
    mockGetApiKeyFromHeaders.mockReturnValue("fbk_invalid");

    const result = await authenticateGatewayRequest(new NextRequest("http://localhost/test"));

    expect(result).toEqual({ status: "invalid" });
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      { hasApiKey: true, reason: "invalid_api_key" },
      "Gateway authentication failed"
    );
  });

  test("logs and returns invalid when gateway token verification fails", async () => {
    const verifyError = new Error("invalid token");

    const result = await authenticateGatewayRequest(new NextRequest("http://localhost/test"), {
      getTokenFromHeaders: () => "header.payload.signature",
      verifyToken: () => {
        throw verifyError;
      },
    });

    expect(result).toEqual({ status: "invalid" });
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      { error: verifyError, hasToken: true, reason: "token_verification_failed" },
      "Gateway authentication failed"
    );
  });

  test("logs and returns invalid when the gateway token user is inactive", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user_1", isActive: false });

    const result = await authenticateGatewayRequest(new NextRequest("http://localhost/test"), {
      getTokenFromHeaders: () => "header.payload.signature",
      verifyToken: () => ({ userId: "user_1" }),
    });

    expect(result).toEqual({ status: "invalid" });
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      {
        hasToken: true,
        reason: "user_missing_or_inactive",
        userId: "user_1",
        userFound: true,
        isActive: false,
      },
      "Gateway authentication failed"
    );
  });

  test("propagates user lookup errors instead of converting them into invalid auth", async () => {
    const lookupError = new Error("database unavailable");
    mockUserFindUnique.mockRejectedValue(lookupError);

    await expect(
      authenticateGatewayRequest(new NextRequest("http://localhost/test"), {
        getTokenFromHeaders: () => "header.payload.signature",
        verifyToken: () => ({ userId: "user_1" }),
      })
    ).rejects.toThrow("database unavailable");
  });
});
