import { createId } from "@paralleldrive/cuid2";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { requireV3SurveyAccess } from "@/app/api/v3/lib/auth";
import { updateSurvey } from "@/lib/survey/service";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { checkExternalUrlsPermission } from "@/modules/survey/editor/lib/check-external-urls-permission";
import { deleteSurvey } from "@/modules/survey/list/lib/survey";
import { buildV3SurveyCreateInput, buildV3SurveyPreview } from "../adapters";
import { ZV3SurveyCreateBody } from "../schemas";
import { DELETE, GET, PATCH } from "./route";

const { mockAuthenticateRequest } = vi.hoisted(() => ({
  mockAuthenticateRequest: vi.fn(),
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
  requireV3SurveyAccess: vi.fn(),
}));

vi.mock("@/lib/survey/service", () => ({
  updateSurvey: vi.fn(),
}));

vi.mock("@/modules/survey/list/lib/survey", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/survey/list/lib/survey")>();
  return {
    ...actual,
    deleteSurvey: vi.fn(),
  };
});

vi.mock("@/modules/survey/editor/lib/check-external-urls-permission", () => ({
  checkExternalUrlsPermission: vi.fn(),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>();
  return {
    ...actual,
    queueAuditEvent: vi.fn(),
  };
});

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

const getServerSession = vi.mocked((await import("next-auth")).getServerSession);

const workspaceId = createId();
const surveyId = createId();
const requestId = "req-item";
const baseCreateBody = {
  workspaceId,
  name: "Item API Survey",
  blocks: [
    {
      id: createId(),
      name: "Intro",
      elements: [
        {
          id: "question_1",
          type: "openText",
          headline: { default: "What should we improve?" },
          required: true,
        },
      ],
    },
  ],
};
const parsedCreateBody = ZV3SurveyCreateBody.parse(baseCreateBody);

function buildSurveyFixture(name = "Item API Survey") {
  return buildV3SurveyPreview(
    workspaceId,
    buildV3SurveyCreateInput(
      {
        ...parsedCreateBody,
        name,
      },
      "user_1"
    ),
    surveyId
  );
}

function createRequest(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("/api/v3/surveys/[surveyId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getServerSession.mockResolvedValue({
      user: { id: "user_1", name: "User", email: "u@example.com" },
      expires: "2026-01-01",
    } as any);
    mockAuthenticateRequest.mockResolvedValue(null);
    vi.mocked(requireV3SurveyAccess).mockResolvedValue({
      environmentId: workspaceId,
      projectId: "proj_1",
      organizationId: "org_1",
      survey: buildSurveyFixture(),
    } as any);
    vi.mocked(updateSurvey).mockResolvedValue(buildSurveyFixture("Updated survey"));
    vi.mocked(deleteSurvey).mockResolvedValue(true);
    vi.mocked(checkExternalUrlsPermission).mockResolvedValue(undefined);
    vi.mocked(queueAuditEvent).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("GET returns the survey resource", async () => {
    const res = await GET(createRequest("GET", `http://localhost/api/v3/surveys/${surveyId}`), {
      params: Promise.resolve({ surveyId }),
    } as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.workspaceId).toBe(workspaceId);
    expect(body.data).not.toHaveProperty("environmentId");
    expect(requireV3SurveyAccess).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      surveyId,
      "read",
      requestId,
      `/api/v3/surveys/${surveyId}`
    );
  });

  test("GET returns route parameter validation errors", async () => {
    const res = await GET(createRequest("GET", "http://localhost/api/v3/surveys/not-valid"), {
      params: Promise.resolve({ surveyId: "not-valid" }),
    } as any);

    expect(res.status).toBe(400);
    expect(requireV3SurveyAccess).not.toHaveBeenCalled();
  });

  test("PATCH updates the survey and returns 200", async () => {
    const res = await PATCH(
      createRequest("PATCH", `http://localhost/api/v3/surveys/${surveyId}`, {
        name: "Updated survey",
      }),
      { params: Promise.resolve({ surveyId }) } as any
    );

    expect(res.status).toBe(200);
    expect(requireV3SurveyAccess).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      surveyId,
      "readWrite",
      requestId,
      `/api/v3/surveys/${surveyId}`
    );
    expect(checkExternalUrlsPermission).toHaveBeenCalled();
    expect(updateSurvey).toHaveBeenCalledWith(
      expect.objectContaining({ id: surveyId, name: "Updated survey" })
    );
    expect(queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "survey",
        targetId: surveyId,
        organizationId: "org_1",
        status: "success",
      })
    );
  });

  test("PATCH rejects immutable fields", async () => {
    const res = await PATCH(
      createRequest("PATCH", `http://localhost/api/v3/surveys/${surveyId}`, {
        workspaceId: createId(),
      }),
      { params: Promise.resolve({ surveyId }) } as any
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.invalid_params).toContainEqual({
      name: "workspaceId",
      reason: "Unsupported field",
    });
    expect(updateSurvey).not.toHaveBeenCalled();
  });

  test("PATCH returns 400 for an empty body", async () => {
    const res = await PATCH(createRequest("PATCH", `http://localhost/api/v3/surveys/${surveyId}`, {}), {
      params: Promise.resolve({ surveyId }),
    } as any);

    expect(res.status).toBe(400);
  });

  test("PATCH returns 403 when external url permission blocks the change", async () => {
    vi.mocked(checkExternalUrlsPermission).mockRejectedValueOnce(
      new OperationNotAllowedError("External URLs are not enabled")
    );

    const res = await PATCH(
      createRequest("PATCH", `http://localhost/api/v3/surveys/${surveyId}`, {
        name: "Blocked update",
      }),
      { params: Promise.resolve({ surveyId }) } as any
    );

    expect(res.status).toBe(403);
  });

  test("PATCH propagates a not found response from survey auth", async () => {
    vi.mocked(requireV3SurveyAccess).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          title: "Not Found",
          status: 404,
          detail: "Survey not found",
          requestId,
        }),
        { status: 404, headers: { "Content-Type": "application/problem+json" } }
      )
    );

    const res = await PATCH(
      createRequest("PATCH", `http://localhost/api/v3/surveys/${surveyId}`, {
        name: "Missing survey",
      }),
      { params: Promise.resolve({ surveyId }) } as any
    );

    expect(res.status).toBe(404);
    expect(updateSurvey).not.toHaveBeenCalled();
  });

  test("DELETE removes the survey and returns 204", async () => {
    const res = await DELETE(createRequest("DELETE", `http://localhost/api/v3/surveys/${surveyId}`), {
      params: Promise.resolve({ surveyId }),
    } as any);

    expect(res.status).toBe(204);
    expect(deleteSurvey).toHaveBeenCalledWith(surveyId);
    expect(res.headers.get("X-Request-Id")).toBe(requestId);
    expect(queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deleted",
        targetType: "survey",
        targetId: surveyId,
        organizationId: "org_1",
        status: "success",
      })
    );
  });
});
