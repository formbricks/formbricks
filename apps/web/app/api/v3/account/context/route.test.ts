import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const { mockGetContext, mockAuthenticateRequest, mockGetSession } = vi.hoisted(() => ({
  mockGetContext: vi.fn(),
  mockAuthenticateRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("../lib/context", () => ({ getV3AccountContext: mockGetContext }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: mockAuthenticateRequest }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({ action, targetType })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })) },
}));

const get = (query = "", headers?: Record<string, string>) =>
  GET(new NextRequest(`http://localhost/api/v3/account/context${query}`, { headers }), {} as never);

describe("GET /api/v3/account/context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContext.mockResolvedValue(Response.json({ data: {} }, { status: 200 }));
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  });

  test("hands the signed-in person to the operation", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(mockGetContext).toHaveBeenCalledWith(
      expect.objectContaining({ authentication: { user: { id: "user_1" } } })
    );
  });

  test("accepts an API key, not only a session", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue({ apiKeyId: "key_1", workspacePermissions: [] });

    const response = await get("", { "x-api-key": "fbk_test" });

    expect(response.status).toBe(200);
    expect(mockGetContext).toHaveBeenCalledWith(
      expect.objectContaining({ authentication: expect.objectContaining({ apiKeyId: "key_1" }) })
    );
  });

  test("takes no query parameters", async () => {
    const response = await get("?organizationId=clorg11111111111111111111");

    expect(response.status).toBe(400);
    expect(mockGetContext).not.toHaveBeenCalled();
  });

  test("refuses an unauthenticated caller before reaching the operation", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue(null);

    const response = await get();

    expect(response.status).toBe(401);
    expect(mockGetContext).not.toHaveBeenCalled();
  });
});
