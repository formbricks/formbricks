import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

/** The samples read behind the route: authentication, write access, and what comes back. */
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  authenticateRequest: vi.fn(),
  applyRateLimit: vi.fn(),
  requireV3WorkspaceAccess: vi.fn(),
  getIsWorkflowsEnabled: vi.fn(),
  workflowFindUnique: vi.fn(),
  sampleFindMany: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: mocks.authenticateRequest }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/app/api/v3/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/api/v3/lib/auth")>()),
  requireV3WorkspaceAccess: mocks.requireV3WorkspaceAccess,
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsWorkflowsEnabled: mocks.getIsWorkflowsEnabled,
}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    workflow: { findUnique: mocks.workflowFindUnique },
    workflowSample: { findMany: mocks.sampleFindMany },
  },
}));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn().mockResolvedValue("org_1"),
}));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@formbricks/logger", () => {
  const log = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
  return { logger: { ...log, withContext: vi.fn(() => log) } };
});

const WORKFLOW_ID = "cm9zr4t2b000208l8h2m1aq3c";
const WORKSPACE_ID = "cm9zr4mps000008l8btfy1vtz";

const get = () =>
  GET(new NextRequest(`http://localhost/api/internal/workflows/${WORKFLOW_ID}/samples`), {
    params: Promise.resolve({ workflowId: WORKFLOW_ID }),
  } as never);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: "cm9zr52kh000508l8e3q7bw9j" }, expires: "2099-01-01" });
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.requireV3WorkspaceAccess.mockResolvedValue({ workspaceId: WORKSPACE_ID, organizationId: "org_1" });
  mocks.getIsWorkflowsEnabled.mockResolvedValue(true);
  mocks.workflowFindUnique.mockResolvedValue({ id: WORKFLOW_ID, workspaceId: WORKSPACE_ID, status: "draft" });
  mocks.sampleFindMany.mockResolvedValue([
    {
      source: "call",
      sample: { status: 200, contentType: "application/json", body: { tier: "gold" } },
      updatedAt: new Date("2026-11-13T09:31:12.000Z"),
    },
    {
      source: "trigger",
      sample: { email: "ana@example.com" },
      updatedAt: new Date("2026-11-13T09:00:00.000Z"),
    },
  ]);
});

describe("GET /api/internal/workflows/{workflowId}/samples", () => {
  test("returns each source's sample of this workflow", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([
      {
        source: "call",
        sample: { status: 200, contentType: "application/json", body: { tier: "gold" } },
        updatedAt: "2026-11-13T09:31:12.000Z",
      },
      { source: "trigger", sample: { email: "ana@example.com" }, updatedAt: "2026-11-13T09:00:00.000Z" },
    ]);
    expect(mocks.sampleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workflowId: WORKFLOW_ID } })
    );
  });

  test("refuses an unauthenticated caller", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.authenticateRequest.mockResolvedValue(null);

    expect((await get()).status).toBe(401);
    expect(mocks.sampleFindMany).not.toHaveBeenCalled();
  });

  test("is session-only: an API key is refused with 401", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.authenticateRequest.mockResolvedValue({
      type: "apiKey",
      apiKeyId: "key_1",
      organizationId: "org_1",
      organizationAccess: { accessControl: { read: true, write: true } },
      workspacePermissions: [{ workspaceId: WORKSPACE_ID, workspaceName: "W", permission: "write" }],
    });

    expect((await get()).status).toBe(401);
    expect(mocks.sampleFindMany).not.toHaveBeenCalled();
  });

  test("needs write access, since samples can hold customer data", async () => {
    mocks.requireV3WorkspaceAccess.mockResolvedValue(
      Response.json(
        { code: "forbidden" },
        { status: 403, headers: { "Content-Type": "application/problem+json" } }
      )
    );

    expect((await get()).status).toBe(403);
    expect(mocks.requireV3WorkspaceAccess.mock.calls[0][2]).toBe("readWrite");
    expect(mocks.sampleFindMany).not.toHaveBeenCalled();
  });

  test("answers an unknown workflow like a forbidden one", async () => {
    mocks.workflowFindUnique.mockResolvedValue(null);

    expect((await get()).status).toBe(403);
    expect(mocks.sampleFindMany).not.toHaveBeenCalled();
  });

  test("answers 403 when the organization has no Workflows", async () => {
    mocks.getIsWorkflowsEnabled.mockResolvedValue(false);

    expect((await get()).status).toBe(403);
    expect(mocks.sampleFindMany).not.toHaveBeenCalled();
  });
});
