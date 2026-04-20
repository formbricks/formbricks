import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { proxy } from "./proxy";

const { mockGetProxySession, mockIsPublicDomainConfigured, mockIsRequestFromPublicDomain } = vi.hoisted(
  () => ({
    mockGetProxySession: vi.fn(),
    mockIsPublicDomainConfigured: vi.fn(),
    mockIsRequestFromPublicDomain: vi.fn(),
  })
);

vi.mock("@/modules/auth/lib/proxy-session", () => ({
  getProxySession: mockGetProxySession,
}));

vi.mock("@/app/middleware/domain-utils", () => ({
  isPublicDomainConfigured: mockIsPublicDomainConfigured,
  isRequestFromPublicDomain: mockIsRequestFromPublicDomain,
}));

vi.mock("@/app/middleware/endpoint-validator", () => ({
  isAuthProtectedRoute: (url: string) => url.startsWith("/environments"),
  isRouteAllowedForDomain: vi.fn(() => true),
}));

vi.mock("@/lib/constants", () => ({
  WEBAPP_URL: "http://localhost:3000",
}));

vi.mock("@/lib/utils/url", () => ({
  getValidatedCallbackUrl: (url: string | null, webAppUrl: string) => {
    if (!url) {
      return null;
    }

    try {
      const parsedWebAppUrl = new URL(webAppUrl);
      const parsedUrl = new URL(url, parsedWebAppUrl.origin);
      return parsedUrl.origin === parsedWebAppUrl.origin ? parsedUrl.toString() : null;
    } catch {
      return null;
    }
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPublicDomainConfigured.mockReturnValue(false);
    mockIsRequestFromPublicDomain.mockReturnValue(false);
  });

  test("redirects unauthenticated protected routes to login with callbackUrl", async () => {
    mockGetProxySession.mockResolvedValue(null);

    const response = await proxy(new NextRequest("http://localhost:3000/environments/test"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/login?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Fenvironments%2Ftest"
    );
  });

  test("rejects invalid callback URLs", async () => {
    mockGetProxySession.mockResolvedValue(null);

    const response = await proxy(
      new NextRequest("http://localhost:3000/auth/login?callbackUrl=https%3A%2F%2Fevil.example")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid callback URL" });
  });

  test("rejects callback URLs that only match the hostname on a different port", async () => {
    mockGetProxySession.mockResolvedValue(null);

    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/auth/login?callbackUrl=http%3A%2F%2Flocalhost%3A4000%2Fenvironments%2Ftest"
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid callback URL" });
  });

  test("redirects authenticated callback requests to the callback URL", async () => {
    mockGetProxySession.mockResolvedValue({
      userId: "user-1",
      expires: new Date(Date.now() + 60_000),
    });

    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/auth/login?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Fenvironments%2Ftest"
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/environments/test");
  });
});
