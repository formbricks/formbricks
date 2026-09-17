import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DELETE } from "./route";

/**
 * The route file is four lines of configuration, and every one of them is a security decision: the auth
 * mode, the permission the operation then demands, the audit target type, and whether the path parameter
 * is validated before it reaches Prisma. None of that is exercised by the operation or service tests,
 * which call past the wrapper entirely — so a wrong `auth` mode here would ship green.
 */
const { mockDelete, mockAuthenticateRequest, mockGetSession } = vi.hoisted(() => ({
  mockDelete: vi.fn(),
  mockAuthenticateRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("../lib/operations", () => ({ deleteV3Response: mockDelete }));
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
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

const RESPONSE_ID = "clrsaaaaaaaaaaaaaaaaaaaa";
const url = (id = RESPONSE_ID) => `http://localhost/api/v3/responses/${id}`;
const ctx = (id = RESPONSE_ID) => ({ params: Promise.resolve({ responseId: id }) }) as never;

describe("DELETE /api/v3/responses/{responseId}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDelete.mockResolvedValue(new Response(null, { status: 204 }));
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  });

  test("passes the validated id through to the operation", async () => {
    const response = await DELETE(new NextRequest(url(), { method: "DELETE" }), ctx());

    expect(response.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ responseId: RESPONSE_ID, auditLog: expect.anything() })
    );
  });

  /**
   * An unparseable id must be a 400 from the schema, not a 500 from Prisma further down — ENG-483 is
   * exactly that bug on the v1 management response route.
   */
  test("rejects a malformed id with 400, before any query runs", async () => {
    const response = await DELETE(
      new NextRequest(url("not-a-cuid"), { method: "DELETE" }),
      ctx("not-a-cuid")
    );

    expect(response.status).toBe(400);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  /**
   * `auth: "both"` — an API key must work, because this is a management endpoint. A session-only route
   * here would break every integration and script that deletes responses through the API.
   */
  test("accepts an API key, not only a session", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue({ apiKeyId: "key_1", workspacePermissions: [] });

    const request = new NextRequest(url(), { method: "DELETE", headers: { "x-api-key": "fbk_test" } });
    const response = await DELETE(request, ctx());

    expect(response.status).toBe(204);
    expect(mockDelete).toHaveBeenCalled();
  });

  test("refuses an unauthenticated caller before reaching the operation", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue(null);

    const response = await DELETE(new NextRequest(url(), { method: "DELETE" }), ctx());

    expect(response.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  test("rejects unrecognized query parameters rather than ignoring them", async () => {
    const request = new NextRequest(`${url()}?workspaceId=ws_1`, { method: "DELETE" });

    const response = await DELETE(request, ctx());

    expect(response.status).toBe(400);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
