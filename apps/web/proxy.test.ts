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

  test("sets the active-workspace cookie from a /workspaces/[workspaceId] path", async () => {
    mockGetProxySession.mockResolvedValue(null);

    const response = await proxy(new NextRequest("http://localhost:3000/workspaces/ws-123/surveys"));

    expect(response.cookies.get("formbricks-workspace-id")?.value).toBe("ws-123");
  });

  test("does not set the active-workspace cookie on non-workspace paths", async () => {
    mockGetProxySession.mockResolvedValue(null);

    const response = await proxy(
      new NextRequest("http://localhost:3000/organizations/org-1/settings/general")
    );

    expect(response.cookies.get("formbricks-workspace-id")).toBeUndefined();
  });

  test("does not re-set the active-workspace cookie when the request already carries the same value", async () => {
    mockGetProxySession.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/workspaces/ws-123/surveys");
    request.cookies.set("formbricks-workspace-id", "ws-123");

    const response = await proxy(request);

    expect(response.cookies.get("formbricks-workspace-id")).toBeUndefined();
  });

  test("updates the active-workspace cookie when navigating to a different workspace", async () => {
    mockGetProxySession.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/workspaces/ws-456/surveys");
    request.cookies.set("formbricks-workspace-id", "ws-123");

    const response = await proxy(request);

    expect(response.cookies.get("formbricks-workspace-id")?.value).toBe("ws-456");
  });
});
