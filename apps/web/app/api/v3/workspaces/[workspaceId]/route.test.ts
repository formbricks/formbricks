import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { PATCH } from "./route";

const { mockOperation, mockAuthenticateRequest, mockGetSession } = vi.hoisted(() => ({
  mockOperation: vi.fn(),
  mockAuthenticateRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("../lib/setup", () => ({ updateV3Workspace: mockOperation }));
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

const WORKSPACE_ID = "clwks11111111111111111111";

const call = (body: unknown, id = WORKSPACE_ID, headers: Record<string, string> = {}) =>
  PATCH(
    new NextRequest(`http://localhost/api/v3/workspaces/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ workspaceId: id }) }
  );

describe("PATCH /api/v3/workspaces/{workspaceId}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOperation.mockResolvedValue(Response.json({ data: { id: WORKSPACE_ID } }, { status: 200 }));
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  });

  test("hands the workspace id, raw body and signed-in person to the operation, audited as a workspace update", async () => {
    const body = { name: "Acme", channel: "link" };

    const response = await call(body);

    expect(response.status).toBe(200);
    expect(mockOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        body,
        authentication: { user: { id: "user_1" } },
        auditLog: expect.objectContaining({ action: "updated", targetType: "workspace" }),
      })
    );
  });

  test("rejects a malformed workspace id with 400 before the operation runs", async () => {
    const response = await call({ name: "Acme", channel: "link" }, "not an id");

    expect(response.status).toBe(400);
    expect(mockOperation).not.toHaveBeenCalled();
  });

  test("accepts an API key, whose manage grant the operation checks", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue({ apiKeyId: "key_1", workspacePermissions: [] });

    const response = await call({ name: "Acme", channel: "link" }, WORKSPACE_ID, { "x-api-key": "fbk_test" });

    expect(response.status).toBe(200);
    expect(mockOperation).toHaveBeenCalledWith(
      expect.objectContaining({ authentication: expect.objectContaining({ apiKeyId: "key_1" }) })
    );
  });

  test("refuses an unauthenticated caller before reaching the operation", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue(null);

    const response = await call({ name: "Acme", channel: "link" });

    expect(response.status).toBe(401);
    expect(mockOperation).not.toHaveBeenCalled();
  });
});
