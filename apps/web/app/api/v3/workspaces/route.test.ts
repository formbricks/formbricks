import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

const { mockCreate, mockAuthenticateRequest, mockGetSession } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockAuthenticateRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("./lib/setup", () => ({ createV3Workspace: mockCreate }));
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
    new NextRequest("http://localhost/api/v3/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    {} as never
  );

describe("POST /api/v3/workspaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue(Response.json({ data: { id: "ws_1" } }, { status: 201 }));
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  });

  test("hands the raw body and the signed-in person to the operation, audited as a workspace create", async () => {
    const body = { organizationId: "clorg11111111111111111111", name: "Acme" };

    const response = await post(body);

    expect(response.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        body,
        authentication: { user: { id: "user_1" } },
        auditLog: expect.objectContaining({ action: "created", targetType: "workspace" }),
      })
    );
  });

  test("never consults an API key: creating a workspace is an organization-level change", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await post(
      { organizationId: "clorg11111111111111111111", name: "Acme" },
      {
        "x-api-key": "fbk_test",
      }
    );

    expect(response.status).toBe(401);
    expect(mockAuthenticateRequest).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
