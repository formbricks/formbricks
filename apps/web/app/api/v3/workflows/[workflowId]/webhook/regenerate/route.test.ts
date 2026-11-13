import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

/**
 * The handler's own rules (write access, archived, no Webhook trigger) are tested in
 * `@formbricks/workflows`; this pins the route configuration around it: who may call it, that the id is
 * validated first, and that the call is audited under the agreed action.
 */
const { mockRegenerate, mockBuildContext, mockAuthenticateRequest, mockGetSession } = vi.hoisted(() => ({
  mockRegenerate: vi.fn(),
  mockBuildContext: vi.fn(),
  mockAuthenticateRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("../../../lib/context", () => ({
  workflowsHandlers: { regenerateWebhook: mockRegenerate },
  buildWorkflowApiContext: mockBuildContext,
}));
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

const WORKFLOW_ID = "cm9zr4t2b000208l8h2m1aq3c";
const request = (id = WORKFLOW_ID, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost/api/v3/workflows/${id}/webhook/regenerate`, { method: "POST", headers });
const props = (id = WORKFLOW_ID) => ({ params: Promise.resolve({ workflowId: id }) }) as never;

describe("POST /api/v3/workflows/{workflowId}/webhook/regenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegenerate.mockResolvedValue(Response.json({ data: {} }, { status: 200 }));
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  });

  test("is audited as webhookUrlRegenerated on the workflow", async () => {
    const response = await POST(request(), props());

    expect(response.status).toBe(200);
    expect(mockBuildContext.mock.calls[0][3]).toMatchObject({
      action: "webhookUrlRegenerated",
      targetType: "workflow",
    });
  });

  test("accepts an API key", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue({ apiKeyId: "key_1", workspacePermissions: [] });

    const response = await POST(request(WORKFLOW_ID, { "x-api-key": "fbk_test" }), props());

    expect(response.status).toBe(200);
  });

  test("refuses an unauthenticated caller", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue(null);

    const response = await POST(request(), props());

    expect(response.status).toBe(401);
    expect(mockRegenerate).not.toHaveBeenCalled();
  });

  test("rejects a malformed id before the handler", async () => {
    const response = await POST(request("not-a-cuid"), props("not-a-cuid"));

    expect(response.status).toBe(400);
    expect(mockRegenerate).not.toHaveBeenCalled();
  });
});
