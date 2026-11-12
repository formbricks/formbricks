import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { POST } from "./route";

/**
 * The route file is configuration, and every line of it is a decision the operation tests cannot see,
 * because they call past the wrapper: the auth mode, the audit action, leaving the rate limit to the operation, and the
 * request schema. `outcome` being required is the contract's 400 and is enforced here or nowhere.
 */
const { mockBatchSetOutcome, mockAuthenticateRequest, mockGetSession, mockQueueAuditEvent } = vi.hoisted(
  () => ({
    mockBatchSetOutcome: vi.fn(),
    mockAuthenticateRequest: vi.fn(),
    mockGetSession: vi.fn(),
    mockQueueAuditEvent: vi.fn(),
  })
);

vi.mock("../lib/operations", () => ({ batchSetV3ResponsesOutcome: mockBatchSetOutcome }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: mockAuthenticateRequest }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mockQueueAuditEvent }));
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
    new NextRequest(`http://localhost/api/v3/responses/batch-outcome${query}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    {} as never
  );

describe("POST /api/v3/responses/batch-outcome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchSetOutcome.mockResolvedValue(Response.json({ data: { updated: 2 } }, { status: 200 }));
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  });

  test.each(["lowQuality", null] as const)(
    "passes the validated scope, ids and outcome %s through to the operation",
    async (outcome) => {
      const response = await post({ ids: [ID_A, ID_B], outcome });

      expect(response.status).toBe(200);
      expect(mockBatchSetOutcome).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: WORKSPACE_ID,
          ids: [ID_A, ID_B],
          outcome,
          auditLog: expect.anything(),
        })
      );
    }
  );

  test("is audited as an update of a response", async () => {
    await post({ ids: [ID_A], outcome: "lowQuality" });

    expect(mockQueueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "updated", targetType: "response" })
    );
  });

  /**
   * The operation charges the state-mutation bucket itself (see its tests), so the MCP tool spends from
   * it too. The wrapper must not charge a second bucket on top, or one REST call would cost twice.
   */
  test("leaves rate limiting to the operation", async () => {
    await post({ ids: [ID_A], outcome: "lowQuality" });

    expect(mockBatchSetOutcome).toHaveBeenCalled();
    expect(applyRateLimit).not.toHaveBeenCalled();
  });

  test("rejects a batch with no workspaceId", async () => {
    const response = await post({ ids: [ID_A], outcome: null }, "");

    expect(response.status).toBe(400);
    expect(mockBatchSetOutcome).not.toHaveBeenCalled();
  });

  test.each([
    ["no outcome, which must not read as a restore", { ids: [ID_A] }],
    ["an unknown outcome", { ids: [ID_A], outcome: "spam" }],
    ["an empty ids array", { ids: [], outcome: null }],
    ["more than 100 ids", { ids: Array.from({ length: 101 }, () => ID_A), outcome: null }],
    ["duplicate ids", { ids: [ID_A, ID_A], outcome: null }],
    ["a malformed id", { ids: ["not-a-cuid"], outcome: null }],
    ["an unsupported field", { ids: [ID_A], outcome: null, finished: true }],
  ])("rejects %s with 400, before any query runs", async (_label, body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(mockBatchSetOutcome).not.toHaveBeenCalled();
  });

  test("accepts an API key, not only a session", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue({ apiKeyId: "key_1", workspacePermissions: [] });

    const response = await POST(
      new NextRequest(`http://localhost/api/v3/responses/batch-outcome?workspaceId=${WORKSPACE_ID}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": "fbk_test" },
        body: JSON.stringify({ ids: [ID_A], outcome: "lowQuality" }),
      }),
      {} as never
    );

    expect(response.status).toBe(200);
    expect(mockBatchSetOutcome).toHaveBeenCalled();
  });

  test("refuses an unauthenticated caller before reaching the operation", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue(null);

    const response = await post({ ids: [ID_A], outcome: "lowQuality" });

    expect(response.status).toBe(401);
    expect(mockBatchSetOutcome).not.toHaveBeenCalled();
  });
});
