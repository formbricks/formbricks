import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

/**
 * Write access and the Webhook-trigger check live in the handler (tested in `@formbricks/workflows`);
 * this pins the route around it: authenticated callers only, API keys included, id validated first.
 */
const { mockGetWebhook, mockAuthenticateRequest, mockGetSession } = vi.hoisted(() => ({
  mockGetWebhook: vi.fn(),
  mockAuthenticateRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("../../lib/context", () => ({
  workflowsHandlers: { getWebhook: mockGetWebhook },
  buildWorkflowApiContext: vi.fn(),
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: mockAuthenticateRequest }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })) },
}));

const WORKFLOW_ID = "cm9zr4t2b000208l8h2m1aq3c";
const request = (id = WORKFLOW_ID, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost/api/v3/workflows/${id}/webhook`, { method: "GET", headers });
const props = (id = WORKFLOW_ID) => ({ params: Promise.resolve({ workflowId: id }) }) as never;

describe("GET /api/v3/workflows/{workflowId}/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWebhook.mockResolvedValue(Response.json({ data: {} }, { status: 200 }));
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  });

  test("reaches the handler with the validated id", async () => {
    const response = await GET(request(), props());

    expect(response.status).toBe(200);
    expect(mockGetWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ params: { workflowId: WORKFLOW_ID } })
    );
  });

  test("accepts an API key", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue({ apiKeyId: "key_1", workspacePermissions: [] });

    expect((await GET(request(WORKFLOW_ID, { "x-api-key": "fbk_test" }), props())).status).toBe(200);
  });

  test("refuses an unauthenticated caller", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue(null);

    expect((await GET(request(), props())).status).toBe(401);
    expect(mockGetWebhook).not.toHaveBeenCalled();
  });

  test("rejects a malformed id before the handler", async () => {
    expect((await GET(request("not-a-cuid"), props("not-a-cuid"))).status).toBe(400);
    expect(mockGetWebhook).not.toHaveBeenCalled();
  });
});
