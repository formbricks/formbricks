import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

/**
 * The route file is configuration, and every line of it is a decision the operation and service tests
 * cannot see, because they call past the wrapper: the auth mode, the audit target, and — the reason
 * this file matters most for a batch — the request schema. The cap, the uniqueness rule and the
 * required scope are the contract's 400s, and they are enforced here or nowhere.
 */
const { mockBatchDelete, mockAuthenticateRequest, mockGetSession } = vi.hoisted(() => ({
  mockBatchDelete: vi.fn(),
  mockAuthenticateRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("../lib/operations", () => ({ batchDeleteV3Responses: mockBatchDelete }));
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

const WORKSPACE_ID = "clsww11111111111111111111";
const ID_A = "clrsaaaaaaaaaaaaaaaaaaaa";
const ID_B = "clrsbbbbbbbbbbbbbbbbbbbb";

const post = (body: unknown, query = `?workspaceId=${WORKSPACE_ID}`) =>
  POST(
    new NextRequest(`http://localhost/api/v3/responses/batch-delete${query}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    {} as never
  );

describe("POST /api/v3/responses/batch-delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchDelete.mockResolvedValue(Response.json({ data: { deleted: 2 } }, { status: 200 }));
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  });

  test("passes the validated scope and ids through to the operation", async () => {
    const response = await post({ ids: [ID_A, ID_B] });

    expect(response.status).toBe(200);
    expect(mockBatchDelete).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: WORKSPACE_ID, ids: [ID_A, ID_B], auditLog: expect.anything() })
    );
  });

  /**
   * Without a scope there is nothing to authorize against and nothing to filter by, so this has to be
   * a 400 rather than a batch that quietly falls back to something.
   */
  test("rejects a batch with no workspaceId", async () => {
    const response = await post({ ids: [ID_A] }, "");

    expect(response.status).toBe(400);
    expect(mockBatchDelete).not.toHaveBeenCalled();
  });

  test.each([
    ["an empty ids array", { ids: [] }],
    ["more than 100 ids", { ids: Array.from({ length: 101 }, () => ID_A) }],
    ["duplicate ids", { ids: [ID_A, ID_A] }],
    ["a malformed id", { ids: ["not-a-cuid"] }],
    ["an unsupported field", { ids: [ID_A], surveyId: "svy_1" }],
  ])("rejects %s with 400, before any query runs", async (_label, body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(mockBatchDelete).not.toHaveBeenCalled();
  });

  test("accepts exactly 100 ids, the documented maximum", async () => {
    const ids = Array.from({ length: 100 }, (_, i) => `clrs${i.toString().padStart(20, "0")}`.slice(0, 24));

    const response = await post({ ids });

    expect(response.status).toBe(200);
    expect(mockBatchDelete).toHaveBeenCalledWith(expect.objectContaining({ ids }));
  });

  test("accepts an API key, not only a session", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue({ apiKeyId: "key_1", workspacePermissions: [] });

    const response = await POST(
      new NextRequest(`http://localhost/api/v3/responses/batch-delete?workspaceId=${WORKSPACE_ID}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": "fbk_test" },
        body: JSON.stringify({ ids: [ID_A] }),
      }),
      {} as never
    );

    expect(response.status).toBe(200);
    expect(mockBatchDelete).toHaveBeenCalled();
  });

  test("refuses an unauthenticated caller before reaching the operation", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue(null);

    const response = await post({ ids: [ID_A] });

    expect(response.status).toBe(401);
    expect(mockBatchDelete).not.toHaveBeenCalled();
  });
});
