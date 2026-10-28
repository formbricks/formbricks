import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { FORMBRICKS_CLIENT_IP_HEADER } from "@/lib/utils/client-ip";
import { INGEST_REQUEST_BODY_LIMIT_BYTES, config, proxy } from "./proxy";

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
  isAuthProtectedRoute: (url: string) => url.startsWith("/organizations"),
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

    const response = await proxy(new NextRequest("http://localhost:3000/organizations/test"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/login?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Forganizations%2Ftest"
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
        "http://localhost:3000/auth/login?callbackUrl=http%3A%2F%2Flocalhost%3A4000%2Forganizations%2Ftest"
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
        "http://localhost:3000/auth/login?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Forganizations%2Ftest"
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/organizations/test");
  });

  test("sets the active-organization cookie from an /organizations/[organizationId] path", async () => {
    mockGetProxySession.mockResolvedValue({
      userId: "user-1",
      expires: new Date(Date.now() + 60_000),
    });

    const response = await proxy(new NextRequest("http://localhost:3000/organizations/org-2/members"));

    expect(response.cookies.get("formbricks-organization-id")?.value).toBe("org-2");
  });

  test("updates the active-organization cookie when navigating to a different organization", async () => {
    mockGetProxySession.mockResolvedValue({
      userId: "user-1",
      expires: new Date(Date.now() + 60_000),
    });

    const request = new NextRequest("http://localhost:3000/organizations/org-3/members");
    request.cookies.set("formbricks-organization-id", "org-2");

    const response = await proxy(request);

    expect(response.cookies.get("formbricks-organization-id")?.value).toBe("org-3");
  });

  test("does not set the active-organization cookie on non-organization paths", async () => {
    mockGetProxySession.mockResolvedValue(null);

    const response = await proxy(new NextRequest("http://localhost:3000/account"));

    expect(response.cookies.get("formbricks-organization-id")).toBeUndefined();
  });

  test("does not re-set the active-organization cookie when the request already carries the same value", async () => {
    mockGetProxySession.mockResolvedValue({
      userId: "user-1",
      expires: new Date(Date.now() + 60_000),
    });

    // A Set-Cookie on a server-action POST forces a router refresh, so an unchanged value must not
    // be written again.
    const request = new NextRequest("http://localhost:3000/organizations/org-2/members");
    request.cookies.set("formbricks-organization-id", "org-2");

    const response = await proxy(request);

    expect(response.cookies.get("formbricks-organization-id")).toBeUndefined();
  });

  test.each([
    ["next-router-prefetch"],
    ["next-router-segment-prefetch"],
    ["next-instant-navigation-testing-prefetch"],
  ])("leaves the active-organization cookie alone on a %s request", async (prefetchHeader) => {
    mockGetProxySession.mockResolvedValue({
      userId: "user-1",
      expires: new Date(Date.now() + 60_000),
    });

    // The router keeps prefetching the links of a tree it rendered earlier, so a prefetch must not
    // overwrite the organization the user is actually in.
    const request = new NextRequest("http://localhost:3000/organizations/org-stale/members", {
      headers: { [prefetchHeader]: "1" },
    });
    request.cookies.set("formbricks-organization-id", "org-current");

    const response = await proxy(request);

    expect(response.cookies.get("formbricks-organization-id")).toBeUndefined();
  });

  test("still sets the active-organization cookie on a client-side navigation", async () => {
    mockGetProxySession.mockResolvedValue({
      userId: "user-1",
      expires: new Date(Date.now() + 60_000),
    });

    // A soft navigation is an RSC request too; only the prefetch headers separate it from a
    // prefetch, so excluding prefetches must not stop the cookie from following a real route change.
    const request = new NextRequest("http://localhost:3000/organizations/org-3/members", {
      headers: { rsc: "1", "next-router-state-tree": "%5B%22%22%5D" },
    });
    request.cookies.set("formbricks-organization-id", "org-2");

    const response = await proxy(request);

    expect(response.cookies.get("formbricks-organization-id")?.value).toBe("org-3");
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

  describe("PostHog /ingest body limit", () => {
    const ingest = (path: string, headers: Record<string, string>) =>
      proxy(new NextRequest(`http://localhost:3000${path}`, { method: "POST", headers }));

    test("refuses a declared body over the limit with 413", async () => {
      const response = await ingest("/ingest/s/", {
        "content-length": String(INGEST_REQUEST_BODY_LIMIT_BYTES + 1),
      });

      expect(response.status).toBe(413);
    });

    test("refuses a Content-Length that does not parse with 413", async () => {
      const response = await ingest("/ingest/e/", { "content-length": "lots" });

      expect(response.status).toBe(413);
    });

    test.each(["/ingest/e/", "/INGEST/e", "/InGeSt/batch", "/Ingest"])(
      "refuses a body of undeclared length to %s with 411",
      async (path) => {
        // Next's rewrite matches any case of the path, so the bound has to as well.
        const response = await ingest(path, { "transfer-encoding": "chunked" });

        expect(response.status).toBe(411);
      }
    );

    test("forwards a body up to the limit", async () => {
      mockGetProxySession.mockResolvedValue(null);
      const response = await ingest("/ingest/e/", {
        "content-length": String(INGEST_REQUEST_BODY_LIMIT_BYTES),
      });

      expect(response.headers.get("x-middleware-next")).toBe("1");
    });

    test.each(["/ingestion", "/api/v1/management/responses"])(
      "leaves %s to its own route's limits",
      async (path) => {
        mockGetProxySession.mockResolvedValue(null);
        const response = await ingest(path, { "transfer-encoding": "chunked" });

        expect(response.headers.get("x-middleware-next")).toBe("1");
      }
    );
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
        url: "/organizations/org-1/members",
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
