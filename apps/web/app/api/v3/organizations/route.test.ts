import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

/**
 * The route is configuration the operation tests cannot see because they call past the wrapper: the
 * session-only auth mode, the audit target, and that the body reaches the operation unparsed so the MCP
 * tool and this route answer the same 400.
 */
const { mockCreate, mockAuthenticateRequest, mockGetSession } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockAuthenticateRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("./lib/create", () => ({ createV3Organization: mockCreate }));
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

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new NextRequest("http://localhost/api/v3/organizations", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    {} as never
  );

describe("POST /api/v3/organizations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue(Response.json({ data: { id: "org_1" } }, { status: 201 }));
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  });

  test("hands the raw body and the signed-in person to the operation, audited as an organization create", async () => {
    const body = { name: "Acme", extra: "left for the operation to reject" };

    const response = await post(body);

    expect(response.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        body,
        authentication: { user: { id: "user_1" } },
        auditLog: expect.objectContaining({ action: "created", targetType: "organization" }),
      })
    );
  });

  test("never consults an API key: an organization belongs to a person", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await post({ name: "Acme" }, { "x-api-key": "fbk_test" });

    expect(response.status).toBe(401);
    expect(mockAuthenticateRequest).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
