import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { requireSessionWorkspaceAccess } from "@/app/api/v3/lib/auth";
import { getSurveyCount, getSurveys } from "@/modules/survey/list/lib/survey";
import { GET } from "./route";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
  applyIPRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return { ...actual, AUDIT_LOG_ENABLED: false };
});

vi.mock("@/app/api/v3/lib/auth", () => ({
  requireSessionWorkspaceAccess: vi.fn(),
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

/** Query param (workspace id in API); distinct from resolved DB environment id. */
const validWorkspaceId = "clxx1234567890123456789012";
const resolvedEnvironmentId = "clzz9876543210987654321098";

function createRequest(url: string, requestId?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (requestId) headers["x-request-id"] = requestId;
  return new NextRequest(url, { headers });
}

describe("GET /api/v3/surveys", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getServerSession.mockResolvedValue({
      user: { id: "user_1", name: "User", email: "u@example.com" },
      expires: "2026-01-01",
    } as any);
    vi.mocked(requireSessionWorkspaceAccess).mockResolvedValue({
      environmentId: resolvedEnvironmentId,
      projectId: "proj_1",
      organizationId: "org_1",
    });
    vi.mocked(getSurveys).mockResolvedValue([]);
    vi.mocked(getSurveyCount).mockResolvedValue(0);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when no session (RFC 9457, handler not run)", async () => {
    getServerSession.mockResolvedValue(null);
    const req = createRequest(`http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}`);
    const res = await GET(req, {} as any);
    expect(res.status).toBe(401);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(requireSessionWorkspaceAccess).not.toHaveBeenCalled();
  });

  test("returns 200 with list envelope when session and valid workspaceId", async () => {
    const req = createRequest(`http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}`, "req-456");
    const res = await GET(req, {} as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("X-Request-Id")).toBe("req-456");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("meta");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toEqual({ limit: 20, offset: 0, total: 0 });
    expect(requireSessionWorkspaceAccess).toHaveBeenCalledWith(
      expect.any(Object),
      validWorkspaceId,
      "read",
      "req-456",
      "/api/v3/surveys"
    );
    expect(getSurveys).toHaveBeenCalledWith(resolvedEnvironmentId, 20, 0, undefined);
    expect(getSurveyCount).toHaveBeenCalledWith(resolvedEnvironmentId, undefined);
  });

  test("returns 400 when workspaceId is missing", async () => {
    const req = createRequest("http://localhost/api/v3/surveys");
    const res = await GET(req, {} as any);
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    const body = await res.json();
    expect(body.requestId).toBeDefined();
    expect(body.status).toBe(400);
    expect(body.invalid_params).toBeDefined();
    expect(requireSessionWorkspaceAccess).not.toHaveBeenCalled();
  });

  test("returns 400 when workspaceId is not cuid2", async () => {
    const req = createRequest("http://localhost/api/v3/surveys?workspaceId=not-a-cuid");
    const res = await GET(req, {} as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe(400);
    expect(body.invalid_params).toBeDefined();
  });

  test("returns 400 when limit exceeds max", async () => {
    const req = createRequest(`http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}&limit=101`);
    const res = await GET(req, {} as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe(400);
  });

  test("reflects limit, offset and total in meta and passes to getSurveys", async () => {
    vi.mocked(getSurveyCount).mockResolvedValue(42);
    const req = createRequest(
      `http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}&limit=10&offset=5`
    );
    const res = await GET(req, {} as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta).toEqual({ limit: 10, offset: 5, total: 42 });
    expect(getSurveys).toHaveBeenCalledWith(resolvedEnvironmentId, 10, 5, undefined);
    expect(getSurveyCount).toHaveBeenCalledWith(resolvedEnvironmentId, undefined);
  });

  test("passes filterCriteria to getSurveys and getSurveyCount so total matches filter", async () => {
    const filterCriteria = { status: ["inProgress"], sortBy: "updatedAt" as const };
    vi.mocked(getSurveys).mockResolvedValue([]);
    vi.mocked(getSurveyCount).mockResolvedValue(7);
    const req = createRequest(
      `http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}&filterCriteria=${encodeURIComponent(JSON.stringify(filterCriteria))}`
    );
    const res = await GET(req, {} as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.total).toBe(7);
    expect(getSurveys).toHaveBeenCalledWith(resolvedEnvironmentId, 20, 0, filterCriteria);
    expect(getSurveyCount).toHaveBeenCalledWith(resolvedEnvironmentId, filterCriteria);
  });

  test("overrides createdBy.userId with session user so clients cannot spoof creator filter", async () => {
    const clientSent = {
      createdBy: { userId: "attacker_id", value: ["you" as const] },
      sortBy: "updatedAt" as const,
    };
    const expectedForDb = {
      createdBy: { userId: "user_1", value: ["you" as const] },
      sortBy: "updatedAt" as const,
    };
    vi.mocked(getSurveys).mockResolvedValue([]);
    vi.mocked(getSurveyCount).mockResolvedValue(1);
    const req = createRequest(
      `http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}&filterCriteria=${encodeURIComponent(JSON.stringify(clientSent))}`
    );
    const res = await GET(req, {} as any);
    expect(res.status).toBe(200);
    expect(getSurveys).toHaveBeenCalledWith(resolvedEnvironmentId, 20, 0, expectedForDb);
    expect(getSurveyCount).toHaveBeenCalledWith(resolvedEnvironmentId, expectedForDb);
  });

  test("returns 403 when auth helper returns 403", async () => {
    const forbiddenResponse = new Response(
      JSON.stringify({
        title: "Forbidden",
        status: 403,
        detail: "You are not authorized to access this resource",
        requestId: "req-789",
      }),
      { status: 403, headers: { "Content-Type": "application/problem+json" } }
    );
    vi.mocked(requireSessionWorkspaceAccess).mockResolvedValueOnce(forbiddenResponse);
    const req = createRequest(`http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}`);
    const res = await GET(req, {} as any);
    expect(res.status).toBe(403);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    const body = await res.json();
    expect(body.requestId).toBeDefined();
    expect(body.status).toBe(403);
  });

  test("success response does not include blocks/questions in list items", async () => {
    const minimalSurvey = {
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
    };
    vi.mocked(getSurveys).mockResolvedValue([minimalSurvey as any]);
    const req = createRequest(`http://localhost/api/v3/surveys?workspaceId=${validWorkspaceId}`);
    const res = await GET(req, {} as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).not.toHaveProperty("blocks");
    expect(body.data[0]).not.toHaveProperty("questions");
    expect(body.data[0].id).toBe("s1");
    expect(body.data[0].responseCount).toBe(0);
  });
});
