import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { FORMBRICKS_CLIENT_IP_HEADER } from "@/lib/utils/client-ip";
import { config, proxy } from "./proxy";

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
  TRUSTED_PROXY_HOP_COUNT: 1,
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
    warn: vi.fn(),
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

  test("overwrites a caller-supplied private IP header with the canonical trusted hop", async () => {
    mockGetProxySession.mockResolvedValue(null);
    const request = new NextRequest("http://localhost:3000/api/auth/sign-in/email", {
      headers: {
        [FORMBRICKS_CLIENT_IP_HEADER]: "198.51.100.99",
        "x-forwarded-for": "198.51.100.10, 203.0.113.7:54321",
      },
    });

    const response = await proxy(request);

    expect(response.headers.get(`x-middleware-request-${FORMBRICKS_CLIENT_IP_HEADER}`)).toBe("203.0.113.7");
    expect(response.headers.get(FORMBRICKS_CLIENT_IP_HEADER)).toBeNull();
  });

  test("removes a caller-supplied private IP header when trusted-hop resolution fails", async () => {
    mockGetProxySession.mockResolvedValue(null);
    const request = new NextRequest("http://localhost:3000/api/auth/sign-in/email", {
      headers: {
        [FORMBRICKS_CLIENT_IP_HEADER]: "198.51.100.99",
        "x-forwarded-for": "not-an-ip",
      },
    });

    const response = await proxy(request);

    expect(response.headers.get(`x-middleware-request-${FORMBRICKS_CLIENT_IP_HEADER}`)).toBeNull();
    expect(response.headers.get("x-middleware-override-headers")?.split(",")).not.toContain(
      FORMBRICKS_CLIENT_IP_HEADER
    );
    expect(response.headers.get(FORMBRICKS_CLIENT_IP_HEADER)).toBeNull();
  });
});

describe("proxy matcher", () => {
  test.each([
    "/api/auth/sign-in/email",
    "/api/auth/sso-recovery/request",
    "/api/auth/sso-recovery/consume/token",
    "/api/v1/client/workspace-1/responses",
    "/api/v2/client/workspace-1/responses",
  ])("includes client-IP consumer %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

  test.each(["/jsonresponse", "/iconscustom", "/publicapi/foo"])(
    "includes dynamic route with asset-like prefix %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    }
  );

  test("includes server-action requests", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: "/workspaces/workspace-1/surveys",
        headers: { "next-action": "server-action-id" },
      })
    ).toBe(true);
  });

  test.each(["/_next/static/chunks/app.js", "/_next/image", "/images/logo.svg", "/favicon.ico"])(
    "excludes static asset %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    }
  );
});
