import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { authenticateGatewayRequest } from "./request";

const { mockAuthenticateApiKeyFromHeaders, mockGetApiKeyFromHeaders, mockGetProxySession, mockLoggerWarn } =
  vi.hoisted(() => ({
    mockAuthenticateApiKeyFromHeaders: vi.fn(),
    mockGetApiKeyFromHeaders: vi.fn(),
    mockGetProxySession: vi.fn(),
    mockLoggerWarn: vi.fn(),
  }));

vi.mock("@/modules/api/lib/api-key-auth", () => ({
  authenticateApiKeyFromHeaders: mockAuthenticateApiKeyFromHeaders,
  getApiKeyFromHeaders: mockGetApiKeyFromHeaders,
}));

vi.mock("@/modules/auth/lib/proxy-session", () => ({
  getProxySession: mockGetProxySession,
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
});
