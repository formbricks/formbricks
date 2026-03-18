import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { withV3ApiWrapper } from "./api-wrapper";

const { mockAuthenticateRequest, mockGetServerSession } = vi.hoisted(() => ({
  mockAuthenticateRequest: vi.fn(),
  mockGetServerSession: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/app/api/v1/auth", () => ({
  authenticateRequest: mockAuthenticateRequest,
}));

vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

describe("withV3ApiWrapper", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetServerSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("uses session auth first in both mode and injects request id into plain responses", async () => {
    const { applyRateLimit } = await import("@/modules/core/rate-limit/helpers");
    mockGetServerSession.mockResolvedValue({
      user: { id: "user_1", name: "Test", email: "t@example.com" },
      expires: "2026-01-01",
    });

    const handler = vi.fn(async ({ authentication, requestId, instance }) => {
      expect(authentication).toMatchObject({ user: { id: "user_1" } });
      expect(requestId).toBe("req-1");
      expect(instance).toBe("/api/v3/surveys");
      return Response.json({ ok: true });
    });

    const wrapped = withV3ApiWrapper({
      auth: "both",
      handler,
    });

    const response = await wrapped(
      new NextRequest("http://localhost/api/v3/surveys?limit=10", {
        headers: { "x-request-id": "req-1" },
      }),
      {} as never
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-Id")).toBe("req-1");
    expect(handler).toHaveBeenCalledOnce();
    expect(vi.mocked(applyRateLimit)).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "api:v3" }),
      "user_1"
    );
    expect(mockAuthenticateRequest).not.toHaveBeenCalled();
  });

  test("falls back to api key auth in both mode", async () => {
    const { applyRateLimit } = await import("@/modules/core/rate-limit/helpers");
    mockAuthenticateRequest.mockResolvedValue({
      type: "apiKey",
      apiKeyId: "key_1",
      organizationId: "org_1",
      organizationAccess: { accessControl: { read: true, write: false } },
      environmentPermissions: [],
    });

    const handler = vi.fn(async ({ authentication }) => {
      expect(authentication).toMatchObject({ apiKeyId: "key_1" });
      return Response.json({ ok: true });
    });

    const wrapped = withV3ApiWrapper({
      auth: "both",
      handler,
    });

    const response = await wrapped(
      new NextRequest("http://localhost/api/v3/surveys", {
        headers: { "x-api-key": "fbk_test" },
      }),
      {} as never
    );

    expect(response.status).toBe(200);
    expect(vi.mocked(applyRateLimit)).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "api:v3" }),
      "key_1"
    );
  });

  test("returns 401 problem response when authentication is required but missing", async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const wrapped = withV3ApiWrapper({
      auth: "both",
      handler,
    });

    const response = await wrapped(new NextRequest("http://localhost/api/v3/surveys"), {} as never);

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");
  });

  test("returns 400 problem response for invalid query input", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user_1" },
      expires: "2026-01-01",
    });

    const handler = vi.fn(async () => Response.json({ ok: true }));
    const wrapped = withV3ApiWrapper({
      auth: "both",
      schemas: {
        query: z.object({
          limit: z.coerce.number().int().positive(),
        }),
      },
      handler,
    });

    const response = await wrapped(
      new NextRequest("http://localhost/api/v3/surveys?limit=oops", {
        headers: { "x-request-id": "req-invalid" },
      }),
      {} as never
    );

    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.invalid_params).toEqual(expect.arrayContaining([expect.objectContaining({ name: "limit" })]));
    expect(body.requestId).toBe("req-invalid");
  });

  test("returns 429 problem response when rate limited", async () => {
    const { applyRateLimit } = await import("@/modules/core/rate-limit/helpers");
    mockGetServerSession.mockResolvedValue({
      user: { id: "user_1" },
      expires: "2026-01-01",
    });
    vi.mocked(applyRateLimit).mockRejectedValueOnce(new Error("Too many requests"));

    const wrapped = withV3ApiWrapper({
      auth: "both",
      handler: async () => Response.json({ ok: true }),
    });

    const response = await wrapped(new NextRequest("http://localhost/api/v3/surveys"), {} as never);

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.code).toBe("too_many_requests");
  });

  test("returns 500 problem response when the handler throws unexpectedly", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user_1" },
      expires: "2026-01-01",
    });

    const wrapped = withV3ApiWrapper({
      auth: "both",
      handler: async () => {
        throw new Error("boom");
      },
    });

    const response = await wrapped(
      new NextRequest("http://localhost/api/v3/surveys", {
        headers: { "x-request-id": "req-boom" },
      }),
      {} as never
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe("internal_server_error");
    expect(body.requestId).toBe("req-boom");
  });
});
