import { ApiKeyPermission, EnvironmentType } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { getSurveyCount, getSurveys } from "@/modules/survey/list/lib/survey";
import { GET } from "./route";

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
  requireV3WorkspaceAccess: vi.fn(),
}));

vi.mock("@/modules/survey/list/lib/survey", () => ({
  getSurveys: vi.fn(),
  getSurveyCount: vi.fn(),
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

const validWorkspaceId = "clxx1234567890123456789012";
const resolvedEnvironmentId = "clzz9876543210987654321098";

function createRequest(url: string, requestId?: string, extraHeaders?: Record<string, string>): NextRequest {
  const headers: Record<string, string> = { ...extraHeaders };
  if (requestId) headers["x-request-id"] = requestId;
  return new NextRequest(url, { headers });
}

const apiKeyAuth = {
  type: "apiKey" as const,
  apiKeyId: "key_1",
  organizationId: "org_1",
  organizationAccess: {
    accessControl: { read: true, write: false },
  },
  environmentPermissions: [
    {
      environmentId: validWorkspaceId,
      environmentType: EnvironmentType.development,
      projectId: "proj_1",
      projectName: "P",
      permission: ApiKeyPermission.read,
    },
  ],
};

describe("GET /api/v3/surveys", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getServerSession.mockResolvedValue({
      user: { id: "user_1", name: "User", email: "u@example.com" },
      expires: "2026-01-01",
    } as any);
    mockAuthenticateRequest.mockResolvedValue(null);
    vi.mocked(requireV3WorkspaceAccess).mockImplementation(async (auth, workspaceId) => {
      if (auth && "apiKeyId" in auth) {
        const p = auth.environmentPermissions.find((e) => e.environmentId === workspaceId);
        if (!p) {
          return new Response(
            JSON.stringify({
              title: "Forbidden",
              status: 403,
              detail: "You are not authorized to access this resource",
              requestId: "req",
            }),
            { status: 403, headers: { "Content-Type": "application/problem+json" } }
          );
        }
        return {
          environmentId: workspaceId,
          projectId: p.projectId,
          organizationId: auth.organizationId,
        };
      }
      return {
        environmentId: resolvedEnvironmentId,
        projectId: "proj_1",
        organizationId: "org_1",
      };
    });
    vi.mocked(getSurveys).mockResolvedValue([]);
    vi.mocked(getSurveyCount).mockResolvedValue(0);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when no session and no API key", async () => {
    getServerSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue(null);
    const req = createRequest(`http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}`);
    const res = await GET(req, {} as any);
    expect(res.status).toBe(401);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(requireV3WorkspaceAccess).not.toHaveBeenCalled();
  });

  test("returns 200 with session and valid workspaceId", async () => {
    const req = createRequest(`http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}`, "req-456");
    const res = await GET(req, {} as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("X-Request-Id")).toBe("req-456");
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      validWorkspaceId,
      "read",
      "req-456",
      "/api/v3/surveys"
    );
    expect(getSurveys).toHaveBeenCalledWith(resolvedEnvironmentId, 20, 0, undefined);
    expect(getSurveyCount).toHaveBeenCalledWith(resolvedEnvironmentId, undefined);
  });

  test("returns 200 with x-api-key when workspace is on the key", async () => {
    getServerSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue(apiKeyAuth as any);
    const req = createRequest(`http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}`, "req-k", {
      "x-api-key": "fbk_test",
    });
    const res = await GET(req, {} as any);
    expect(res.status).toBe(200);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      expect.objectContaining({ apiKeyId: "key_1" }),
      validWorkspaceId,
      "read",
      "req-k",
      "/api/v3/surveys"
    );
    expect(getSurveys).toHaveBeenCalledWith(validWorkspaceId, 20, 0, undefined);
    expect(getSurveyCount).toHaveBeenCalledWith(validWorkspaceId, undefined);
  });

  test("returns 403 when API key does not include workspace", async () => {
    getServerSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue({
      ...apiKeyAuth,
      environmentPermissions: [
        {
          environmentId: "claa1111111111111111111111",
          environmentType: EnvironmentType.development,
          projectId: "proj_x",
          projectName: "X",
          permission: ApiKeyPermission.read,
        },
      ],
    } as any);
    const req = createRequest(`http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}`, undefined, {
      "x-api-key": "fbk_test",
    });
    const res = await GET(req, {} as any);
    expect(res.status).toBe(403);
  });

  test("returns 400 when API key and createdBy filter", async () => {
    getServerSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue(apiKeyAuth as any);
    const req = createRequest(
      `http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}&createdBy=you`,
      undefined,
      { "x-api-key": "fbk_test" }
    );
    const res = await GET(req, {} as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.invalid_params?.some((p: { name: string }) => p.name === "createdBy")).toBe(true);
    expect(requireV3WorkspaceAccess).not.toHaveBeenCalled();
  });

  test("returns 400 when workspaceId is missing", async () => {
    const req = createRequest("http://localhost/api/v3/surveys");
    const res = await GET(req, {} as any);
    expect(res.status).toBe(400);
    expect(requireV3WorkspaceAccess).not.toHaveBeenCalled();
  });

  test("returns 400 when workspaceId is not cuid2", async () => {
    const req = createRequest("http://localhost/api/v3/surveys?workspaceId=not-a-cuid");
    const res = await GET(req, {} as any);
    expect(res.status).toBe(400);
  });

  test("returns 400 when limit exceeds max", async () => {
    const req = createRequest(`http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}&limit=101`);
    const res = await GET(req, {} as any);
    expect(res.status).toBe(400);
  });

  test("reflects limit, offset and total in meta", async () => {
    vi.mocked(getSurveyCount).mockResolvedValue(42);
    const req = createRequest(
      `http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}&limit=10&offset=5`
    );
    const res = await GET(req, {} as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta).toEqual({ limit: 10, offset: 5, total: 42 });
    expect(getSurveys).toHaveBeenCalledWith(resolvedEnvironmentId, 10, 5, undefined);
  });

  test("passes filter query to getSurveys and getSurveyCount", async () => {
    const filterCriteria = { status: ["inProgress"], sortBy: "updatedAt" as const };
    vi.mocked(getSurveyCount).mockResolvedValue(7);
    const req = createRequest(
      `http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}&status=inProgress&sortBy=updatedAt`
    );
    const res = await GET(req, {} as any);
    expect(res.status).toBe(200);
    expect(getSurveys).toHaveBeenCalledWith(resolvedEnvironmentId, 20, 0, filterCriteria);
    expect(getSurveyCount).toHaveBeenCalledWith(resolvedEnvironmentId, filterCriteria);
  });

  test("createdBy uses session user id", async () => {
    const expectedForDb = {
      createdBy: { userId: "user_1", value: ["you" as const] },
      sortBy: "updatedAt" as const,
    };
    vi.mocked(getSurveyCount).mockResolvedValue(1);
    const req = createRequest(
      `http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}&createdBy=you&sortBy=updatedAt`
    );
    const res = await GET(req, {} as any);
    expect(res.status).toBe(200);
    expect(getSurveys).toHaveBeenCalledWith(resolvedEnvironmentId, 20, 0, expectedForDb);
  });

  test("returns 400 when filterCriteria is used", async () => {
    const req = createRequest(
      `http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}&filterCriteria=${encodeURIComponent("{}")}`
    );
    const res = await GET(req, {} as any);
    expect(res.status).toBe(400);
    expect(requireV3WorkspaceAccess).not.toHaveBeenCalled();
  });

  test("returns 403 when auth returns 403", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          title: "Forbidden",
          status: 403,
          detail: "You are not authorized to access this resource",
          requestId: "req-789",
        }),
        { status: 403, headers: { "Content-Type": "application/problem+json" } }
      )
    );
    const req = createRequest(`http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}`);
    const res = await GET(req, {} as any);
    expect(res.status).toBe(403);
  });

  test("list items omit blocks and questions", async () => {
    vi.mocked(getSurveys).mockResolvedValue([
      {
        id: "s1",
        name: "Survey 1",
        environmentId: "env_1",
        type: "link",
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
        responseCount: 0,
        creator: { name: "Test" },
        singleUse: null,
      } as any,
    ]);
    const req = createRequest(`http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}`);
    const res = await GET(req, {} as any);
    const body = await res.json();
    expect(body.data[0]).not.toHaveProperty("blocks");
    expect(body.data[0]).not.toHaveProperty("singleUse");
    expect(body.data[0].id).toBe("s1");
  });

  test("returns 403 when getSurveys throws ResourceNotFoundError", async () => {
    vi.mocked(getSurveys).mockRejectedValueOnce(new ResourceNotFoundError("survey", "s1"));
    const req = createRequest(`http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}`, "req-nf");
    const res = await GET(req, {} as any);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("forbidden");
  });

  test("returns 500 when getSurveys throws DatabaseError", async () => {
    vi.mocked(getSurveys).mockRejectedValueOnce(new DatabaseError("db down"));
    const req = createRequest(`http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}`, "req-db");
    const res = await GET(req, {} as any);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("internal_server_error");
  });

  test("returns 500 on unexpected error from getSurveys", async () => {
    vi.mocked(getSurveys).mockRejectedValueOnce(new Error("boom"));
    const req = createRequest(`http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}`, "req-err");
    const res = await GET(req, {} as any);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("internal_server_error");
  });
});
