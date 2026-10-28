import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET, PUT } from "./route";

/**
 * The route's own decisions: the auth mode, the audit target, the body schema, and what happens to the
 * wrapper's audit entry. The adapter is replaced; its behaviour is tested in `document/adapter.test.ts`.
 */
const { mockPull, mockPush, mockAuthenticateRequest, mockGetSession, mockQueueAuditEvent } = vi.hoisted(
  () => ({
    mockPull: vi.fn(),
    mockPush: vi.fn(),
    mockAuthenticateRequest: vi.fn(),
    mockGetSession: vi.fn(),
    mockQueueAuditEvent: vi.fn(),
  })
);

vi.mock("../../document/adapter", () => ({
  surveyDocumentAdapter: { pull: mockPull, push: mockPush },
}));
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
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

const SURVEY_ID = "tz4a98xxat96iws9zmbrgj4c";
const url = `http://localhost/api/v3/surveys/${SURVEY_ID}/document`;
const ctx = { params: Promise.resolve({ surveyId: SURVEY_ID }) } as never;

const putRequest = (body: unknown) =>
  new NextRequest(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const pushBody = {
  schemaVersion: 1,
  expectedUpdatedAt: "2026-10-16T09:30:00.000Z",
  document: { name: "Notice" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  mockPull.mockResolvedValue(Response.json({ data: {} }));
  mockPush.mockResolvedValue(Response.json({ data: {} }));
  mockQueueAuditEvent.mockResolvedValue(undefined);
});

describe("GET /api/v3/surveys/{surveyId}/document", () => {
  test("pulls the survey named by the validated path", async () => {
    const response = await GET(new NextRequest(url), ctx);

    expect(response.status).toBe(200);
    expect(mockPull).toHaveBeenCalledWith(expect.objectContaining({ id: SURVEY_ID }));
  });

  test("accepts an API key, not only a session", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue({ apiKeyId: "key_1", workspacePermissions: [] });

    const response = await GET(new NextRequest(url, { headers: { "x-api-key": "fbk_test" } }), ctx);

    expect(response.status).toBe(200);
  });

  test("refuses an unauthenticated caller before the adapter", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue(null);

    expect((await GET(new NextRequest(url), ctx)).status).toBe(401);
    expect(mockPull).not.toHaveBeenCalled();
  });
});

describe("PUT /api/v3/surveys/{surveyId}/document", () => {
  test("hands the adapter the document, its precondition and the flags, defaulting both flags off", async () => {
    const response = await PUT(putRequest(pushBody), ctx);

    expect(response.status).toBe(200);
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        id: SURVEY_ID,
        document: pushBody.document,
        expectedUpdatedAt: pushBody.expectedUpdatedAt,
        dryRun: false,
        confirmDestructive: false,
      })
    );
  });

  test("a push is audited as an update of a survey, with the adapter's audit entry", async () => {
    mockPush.mockImplementation(async ({ auditLog }) => {
      auditLog.targetId = SURVEY_ID;
      return Response.json({ data: {} });
    });

    await PUT(putRequest(pushBody), ctx);

    expect(mockQueueAuditEvent).toHaveBeenCalledTimes(1);
    expect(mockQueueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "survey",
        targetId: SURVEY_ID,
        status: "success",
      })
    );
  });

  test("a dry run records no audit event and gives the adapter no audit entry", async () => {
    const response = await PUT(putRequest({ ...pushBody, dryRun: true }), ctx);

    expect(response.status).toBe(200);
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true, auditLog: undefined }));
    expect(mockQueueAuditEvent).not.toHaveBeenCalled();
  });

  test.each([
    ["without expectedUpdatedAt", { ...pushBody, expectedUpdatedAt: undefined }],
    ["with a key the push body does not know", { ...pushBody, workspaceId: "clws1234567890123456789012" }],
    ["with another schemaVersion", { ...pushBody, schemaVersion: 2 }],
  ])("answers 400 for a body %s, before the adapter", async (_name, body) => {
    const response = await PUT(putRequest(body), ctx);

    expect(response.status).toBe(400);
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("rejects a malformed id with 400", async () => {
    const response = await PUT(putRequest(pushBody), {
      params: Promise.resolve({ surveyId: "not-a-cuid" }),
    } as never);

    expect(response.status).toBe(400);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
