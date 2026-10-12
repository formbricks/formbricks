import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

/**
 * The create route's body is a generated schema with a refinement layer on top. Strictness is what
 * turns a field the contract does not define into a 400 naming it, rather than a write that silently
 * ignores it — the mass-assignment guard. The generator strips unknown keys unless told otherwise, so
 * this drives the real wrapper to prove the route still refuses one.
 */
const { mockCreate, mockGetSession } = vi.hoisted(() => ({ mockCreate: vi.fn(), mockGetSession: vi.fn() }));

vi.mock("./lib/operations", () => ({ createV3Response: mockCreate, listV3Responses: vi.fn() }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
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

const SURVEY_ID = "clsv000000000000000000001";
const post = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/v3/responses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) } as never
  );

describe("POST /api/v3/responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
    mockCreate.mockResolvedValue(new Response(null, { status: 201 }));
  });

  test("passes a valid body through to the operation", async () => {
    const response = await post({ surveyId: SURVEY_ID, finished: true, data: {} });

    expect(response.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ body: { surveyId: SURVEY_ID, finished: true, data: {} } })
    );
  });

  test.each([
    [
      "at the top level",
      { surveyId: SURVEY_ID, finished: true, data: {}, createdAt: "2020-01-01" },
      "createdAt",
    ],
    [
      "inside meta",
      { surveyId: SURVEY_ID, finished: true, data: {}, meta: { pagePath: "/" } },
      "meta.pagePath",
    ],
  ])("a field the contract does not define is a 400 naming it %s", async (_where, body, name) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
    const problem = (await response.json()) as { invalid_params: { name: string; code?: string }[] };
    expect(problem.invalid_params).toContainEqual(
      expect.objectContaining({ name, code: "unsupported_field" })
    );
  });
});
