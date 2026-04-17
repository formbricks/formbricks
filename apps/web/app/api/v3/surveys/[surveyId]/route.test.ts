import { ApiKeyPermission, EnvironmentType } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { getSurvey } from "@/lib/survey/service";
import { deleteSurvey } from "@/modules/survey/lib/surveys";
import { DELETE } from "./route";

const { mockAuthenticateRequest } = vi.hoisted(() => ({
  mockAuthenticateRequest: vi.fn(),
}));

const { mockQueueAuditEvent, mockBuildAuditLogBaseObject } = vi.hoisted(() => ({
  mockQueueAuditEvent: vi.fn().mockImplementation(async () => undefined),
  mockBuildAuditLogBaseObject: vi.fn((action: string, targetType: string, apiUrl: string) => ({
    action,
    targetType,
    userId: "unknown",
    targetId: "unknown",
    organizationId: "unknown",
    status: "failure",
    oldObject: undefined,
    newObject: undefined,
    userType: "api",
    apiUrl,
  })),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/app/api/v1/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/api/v1/auth")>();
  return { ...actual, authenticateRequest: mockAuthenticateRequest };
});

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
  applyIPRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return { ...actual, AUDIT_LOG_ENABLED: false };
});

vi.mock("@/app/api/v3/lib/auth", () => ({
  requireV3WorkspaceAccess: vi.fn(),
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));

vi.mock("@/modules/survey/lib/surveys", () => ({
  deleteSurvey: vi.fn(),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEvent: mockQueueAuditEvent,
}));

vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: mockBuildAuditLogBaseObject,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

const getServerSession = vi.mocked((await import("next-auth")).getServerSession);
const queueAuditEvent = vi.mocked((await import("@/modules/ee/audit-logs/lib/handler")).queueAuditEvent);

const surveyId = "clxx1234567890123456789012";
const environmentId = "clzz9876543210987654321098";

function createRequest(url: string, requestId?: string, extraHeaders?: Record<string, string>): NextRequest {
  const headers: Record<string, string> = { ...extraHeaders };
  if (requestId) {
    headers["x-request-id"] = requestId;
  }

  return new NextRequest(url, {
    method: "DELETE",
    headers,
  });
}

const apiKeyAuth = {
  type: "apiKey" as const,
  apiKeyId: "key_1",
  organizationId: "org_1",
  organizationAccess: {
    accessControl: { read: true, write: true },
  },
  environmentPermissions: [
    {
      environmentId,
      environmentType: EnvironmentType.development,
      projectId: "proj_1",
      projectName: "P",
      permission: ApiKeyPermission.write,
    },
  ],
};

describe("DELETE /api/v3/surveys/[surveyId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getServerSession.mockResolvedValue({
      user: { id: "user_1", name: "User", email: "u@example.com" },
      expires: "2026-01-01",
    } as any);
    mockAuthenticateRequest.mockResolvedValue(null);
    vi.mocked(getSurvey).mockResolvedValue({
      id: surveyId,
      name: "Delete me",
      environmentId,
      type: "link",
      status: "draft",
      createdAt: new Date("2026-04-15T10:00:00.000Z"),
      updatedAt: new Date("2026-04-15T10:00:00.000Z"),
      responseCount: 0,
      creator: { name: "User" },
      singleUse: null,
    } as any);
    vi.mocked(deleteSurvey).mockResolvedValue({
      id: surveyId,
      environmentId,
      type: "link",
      segment: null,
      triggers: [],
    } as any);
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({
      environmentId,
      projectId: "proj_1",
      organizationId: "org_1",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when no session and no API key", async () => {
    getServerSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue(null);

    const res = await DELETE(createRequest(`http://localhost/api/v3/surveys/${surveyId}`), {
      params: Promise.resolve({ surveyId }),
    } as never);

    expect(res.status).toBe(401);
    expect(vi.mocked(getSurvey)).not.toHaveBeenCalled();
  });

  test("returns 200 with session auth and deletes the survey", async () => {
    const res = await DELETE(createRequest(`http://localhost/api/v3/surveys/${surveyId}`, "req-delete"), {
      params: Promise.resolve({ surveyId }),
    } as never);

    expect(res.status).toBe(200);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      environmentId,
      "readWrite",
      "req-delete",
      `/api/v3/surveys/${surveyId}`
    );
    expect(deleteSurvey).toHaveBeenCalledWith(surveyId);
    expect(await res.json()).toEqual({
      data: {
        id: surveyId,
      },
    });
  });

  test("returns 200 with x-api-key when the key can delete in the survey workspace", async () => {
    getServerSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue(apiKeyAuth as any);

    const res = await DELETE(
      createRequest(`http://localhost/api/v3/surveys/${surveyId}`, "req-api-key", {
        "x-api-key": "fbk_test",
      }),
      {
        params: Promise.resolve({ surveyId }),
      } as never
    );

    expect(res.status).toBe(200);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      expect.objectContaining({ apiKeyId: "key_1" }),
      environmentId,
      "readWrite",
      "req-api-key",
      `/api/v3/surveys/${surveyId}`
    );
  });

  test("returns 400 when surveyId is invalid", async () => {
    const res = await DELETE(createRequest("http://localhost/api/v3/surveys/not-a-cuid"), {
      params: Promise.resolve({ surveyId: "not-a-cuid" }),
    } as never);

    expect(res.status).toBe(400);
    expect(vi.mocked(getSurvey)).not.toHaveBeenCalled();
  });

  test("returns 403 when the survey does not exist", async () => {
    vi.mocked(getSurvey).mockResolvedValueOnce(null);

    const res = await DELETE(createRequest(`http://localhost/api/v3/surveys/${surveyId}`), {
      params: Promise.resolve({ surveyId }),
    } as never);

    expect(res.status).toBe(403);
    expect(deleteSurvey).not.toHaveBeenCalled();
  });

  test("returns 403 when the user lacks readWrite workspace access", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          title: "Forbidden",
          status: 403,
          detail: "You are not authorized to access this resource",
          requestId: "req-forbidden",
        }),
        { status: 403, headers: { "Content-Type": "application/problem+json" } }
      )
    );

    const res = await DELETE(createRequest(`http://localhost/api/v3/surveys/${surveyId}`, "req-forbidden"), {
      params: Promise.resolve({ surveyId }),
    } as never);

    expect(res.status).toBe(403);
    expect(deleteSurvey).not.toHaveBeenCalled();
    expect(queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deleted",
        targetType: "survey",
        targetId: "unknown",
        organizationId: "unknown",
        userId: "user_1",
        userType: "user",
        status: "failure",
        oldObject: undefined,
      })
    );
  });

  test("returns 500 when survey deletion fails", async () => {
    vi.mocked(deleteSurvey).mockRejectedValueOnce(new DatabaseError("db down"));

    const res = await DELETE(createRequest(`http://localhost/api/v3/surveys/${surveyId}`, "req-db"), {
      params: Promise.resolve({ surveyId }),
    } as never);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("internal_server_error");
  });

  test("returns 403 when the survey is deleted after authorization succeeds", async () => {
    vi.mocked(deleteSurvey).mockRejectedValueOnce(new ResourceNotFoundError("Survey", surveyId));

    const res = await DELETE(createRequest(`http://localhost/api/v3/surveys/${surveyId}`, "req-race"), {
      params: Promise.resolve({ surveyId }),
    } as never);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("forbidden");
    expect(queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deleted",
        targetType: "survey",
        targetId: surveyId,
        organizationId: "org_1",
        userId: "user_1",
        userType: "user",
        status: "failure",
        oldObject: expect.objectContaining({
          id: surveyId,
          environmentId,
        }),
      })
    );
  });

  test("queues an audit log with target, actor, organization, and old object", async () => {
    await DELETE(createRequest(`http://localhost/api/v3/surveys/${surveyId}`, "req-audit"), {
      params: Promise.resolve({ surveyId }),
    } as never);

    expect(queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deleted",
        targetType: "survey",
        targetId: surveyId,
        organizationId: "org_1",
        userId: "user_1",
        userType: "user",
        status: "success",
        oldObject: expect.objectContaining({
          id: surveyId,
          environmentId,
        }),
      })
    );
  });
});
