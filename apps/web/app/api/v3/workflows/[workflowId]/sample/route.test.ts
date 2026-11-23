import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { PUT } from "./route";

/**
 * Write access, size and depth rules live in the handler (tested in `@formbricks/workflows`); this pins
 * the route around it: authenticated callers only, API keys included, id validated first, and the body
 * left for the handler to read.
 */
const { mockSetSample, mockAuthenticateRequest, mockGetSession } = vi.hoisted(() => ({
  mockSetSample: vi.fn(),
  mockAuthenticateRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("../../lib/context", () => ({
  workflowsHandlers: { setSample: mockSetSample },
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
  new NextRequest(`http://localhost/api/v3/workflows/${id}/sample`, {
    method: "PUT",
    body: JSON.stringify({ payload: { order: 1 } }),
    headers: { "Content-Type": "application/json", ...headers },
  });
const props = (id = WORKFLOW_ID) => ({ params: Promise.resolve({ workflowId: id }) }) as never;

describe("PUT /api/v3/workflows/{workflowId}/sample", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetSample.mockImplementation(async ({ req }: { req: Request }) =>
      Response.json({ data: await req.json() }, { status: 200 })
    );
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  });

  test("hands the unread body to the handler", async () => {
    const response = await PUT(request(), props());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { payload: { order: 1 } } });
  });

  test("accepts an API key", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue({ apiKeyId: "key_1", workspacePermissions: [] });

    expect((await PUT(request(WORKFLOW_ID, { "x-api-key": "fbk_test" }), props())).status).toBe(200);
  });

  test("refuses an unauthenticated caller", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue(null);

    expect((await PUT(request(), props())).status).toBe(401);
    expect(mockSetSample).not.toHaveBeenCalled();
  });

  test("rejects a malformed id before the handler", async () => {
    expect((await PUT(request("not-a-cuid"), props("not-a-cuid"))).status).toBe(400);
    expect(mockSetSample).not.toHaveBeenCalled();
  });
});
