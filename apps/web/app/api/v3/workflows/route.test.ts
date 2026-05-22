import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { createDefaultWorkflowDefinition } from "@/modules/workflows/lib/default-workflow";
import { createWorkflow, listWorkflows, listWorkspaceWorkflowRuns } from "@/modules/workflows/lib/service";
import { GET, POST } from "./route";
import { GET as GET_WORKSPACE_RUNS } from "./runs/route";

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

vi.mock("@/modules/workflows/lib/service", () => ({
  createWorkflow: vi.fn(),
  listWorkflows: vi.fn(),
  listWorkspaceWorkflowRuns: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

const getServerSession = vi.mocked((await import("next-auth")).getServerSession);

const workspaceId = "cm8cmpnjj000108jfdr9dfqe8";
const workflowId = "cm8cmpnjj000108jfdr9dfqe7";

function createRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

describe("/api/v3/workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSession.mockResolvedValue({
      expires: "2026-01-01",
      user: { email: "u@example.com", id: "user_1", name: "User" },
    } as never);
    mockAuthenticateRequest.mockResolvedValue(null);
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({
      organizationId: "org_1",
      workspaceId,
    });
    vi.mocked(listWorkflows).mockResolvedValue({ nextCursor: null, workflows: [] } as never);
  });

  test("lists workflows through workspace-scoped v3 access", async () => {
    const req = createRequest(`http://localhost/api/v3/workflows?workspaceId=${workspaceId}&limit=10`);

    const res = await GET(req, {} as never);

    expect(res.status).toBe(200);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      workspaceId,
      "read",
      expect.any(String),
      "/api/v3/workflows"
    );
    expect(listWorkflows).toHaveBeenCalledWith({
      cursor: undefined,
      limit: 10,
      status: undefined,
      workspaceId,
    });
  });

  test("creates draft workflows through the v3 API", async () => {
    const definition = createDefaultWorkflowDefinition();
    vi.mocked(createWorkflow).mockResolvedValue({
      createdAt: new Date("2026-04-07T10:00:00.000Z"),
      createdBy: "user_1",
      description: "Notify the team when a response matches the PoC branch.",
      definition,
      id: workflowId,
      name: "Response completed workflow",
      status: "draft",
      updatedAt: new Date("2026-04-07T10:00:00.000Z"),
      workspaceId,
    } as never);
    const req = createRequest("http://localhost/api/v3/workflows", {
      body: JSON.stringify({
        description: "Notify the team when a response matches the PoC branch.",
        definition,
        name: "Response completed workflow",
        workspaceId,
      }),
      method: "POST",
    });

    const res = await POST(req, {} as never);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.id).toBe(workflowId);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      workspaceId,
      "readWrite",
      expect.any(String),
      "/api/v3/workflows"
    );
    expect(createWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Notify the team when a response matches the PoC branch.",
        definition,
        name: "Response completed workflow",
        workspaceId,
      })
    );
  });

  test("lists workspace workflow runs through workspace-scoped v3 access", async () => {
    vi.mocked(listWorkspaceWorkflowRuns).mockResolvedValue({
      nextCursor: null,
      runs: [
        {
          createdAt: new Date("2026-04-07T10:00:00.000Z"),
          data: { steps: [], logs: [] },
          error: null,
          finishedAt: null,
          id: "cm8cmpnjj000108jfdr9dfqe6",
          responseId: "cm8cmpnjj000108jfdr9dfqe5",
          startedAt: null,
          status: "queued",
          surveyId: "cm8cmpnjj000108jfdr9dfqe4",
          triggerEvent: "response.completed",
          triggerPayload: {},
          updatedAt: new Date("2026-04-07T10:00:00.000Z"),
          workflow: {
            createdAt: new Date("2026-04-07T10:00:00.000Z"),
            createdBy: "user_1",
            definition: createDefaultWorkflowDefinition(),
            description: null,
            id: workflowId,
            name: "Response completed workflow",
            status: "enabled",
            updatedAt: new Date("2026-04-07T10:00:00.000Z"),
            workspaceId,
          },
          workflowId,
          workspaceId,
        },
      ],
    } as never);
    const req = createRequest(`http://localhost/api/v3/workflows/runs?workspaceId=${workspaceId}&limit=10`);

    const res = await GET_WORKSPACE_RUNS(req, {} as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].workflow.name).toBe("Response completed workflow");
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      workspaceId,
      "read",
      expect.any(String),
      "/api/v3/workflows/runs"
    );
    expect(listWorkspaceWorkflowRuns).toHaveBeenCalledWith({
      cursor: undefined,
      limit: 10,
      status: undefined,
      workspaceId,
    });
  });

  test("rejects deferred compute actions before service calls", async () => {
    const req = createRequest("http://localhost/api/v3/workflows", {
      body: JSON.stringify({
        definition: {
          ...createDefaultWorkflowDefinition(),
          nodes: [
            {
              actionType: "compute",
              config: {},
              id: "compute-1",
              type: "action",
            },
          ],
        },
        name: "Unsupported workflow",
        workspaceId,
      }),
      method: "POST",
    });

    const res = await POST(req, {} as never);

    expect(res.status).toBe(400);
    expect(requireV3WorkspaceAccess).not.toHaveBeenCalled();
    expect(createWorkflow).not.toHaveBeenCalled();
  });
});
