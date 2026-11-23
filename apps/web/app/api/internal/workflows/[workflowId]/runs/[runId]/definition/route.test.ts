import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

/** The run definition read behind the route: authentication, read access, scoping, what comes back. */
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  authenticateRequest: vi.fn(),
  applyRateLimit: vi.fn(),
  requireV3WorkspaceAccess: vi.fn(),
  getIsWorkflowsEnabled: vi.fn(),
  workflowFindUnique: vi.fn(),
  runFindFirst: vi.fn(),
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
    workflowRun: { findFirst: mocks.runFindFirst },
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
const RUN_ID = "cm9zr4w9d000308l8c5n8xk7e";

const get = (runId = RUN_ID) =>
  GET(new NextRequest(`http://localhost/api/internal/workflows/${WORKFLOW_ID}/runs/${runId}/definition`), {
    params: Promise.resolve({ workflowId: WORKFLOW_ID, runId }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: "cm9zr52kh000508l8e3q7bw9j" }, expires: "2099-01-01" });
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.requireV3WorkspaceAccess.mockResolvedValue({ workspaceId: WORKSPACE_ID, organizationId: "org_1" });
  mocks.getIsWorkflowsEnabled.mockResolvedValue(true);
  mocks.workflowFindUnique.mockResolvedValue({
    id: WORKFLOW_ID,
    workspaceId: WORKSPACE_ID,
    status: "enabled",
  });
  mocks.runFindFirst.mockResolvedValue({
    testRunDefinition: null,
    workflowVersion: { version: 4, definition: { entryNodeId: "published" } },
  });
});

describe("GET /api/internal/workflows/{workflowId}/runs/{runId}/definition", () => {
  test("returns a live run's version definition, looking the run up within this workflow and workspace", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      source: "version",
      versionNumber: 4,
      definition: { entryNodeId: "published" },
    });
    expect(mocks.runFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RUN_ID, workflowId: WORKFLOW_ID, workspaceId: WORKSPACE_ID },
      })
    );
  });

  test("returns the draft a Test run saved", async () => {
    mocks.runFindFirst.mockResolvedValue({
      testRunDefinition: { entryNodeId: "draft" },
      workflowVersion: null,
    });

    const response = await get();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      source: "test_run",
      definition: { entryNodeId: "draft" },
    });
  });

  test("never returns a stored secret header's id, for a version or a Test run's draft", async () => {
    const definition = {
      entryNodeId: "trigger",
      nodes: [
        {
          id: "call",
          type: "action",
          actionType: "http_request",
          config: { headers: [{ name: "Authorization", secret: true, secretId: "sec_1" }] },
        },
      ],
    };
    for (const run of [
      { testRunDefinition: null, workflowVersion: { version: 4, definition } },
      { testRunDefinition: definition, workflowVersion: null },
    ]) {
      mocks.runFindFirst.mockResolvedValue(run);
      const body = await (await get()).json();
      expect(JSON.stringify(body)).not.toContain("sec_1");
      expect(body.data.definition).toEqual({
        entryNodeId: "trigger",
        nodes: [
          {
            id: "call",
            type: "action",
            actionType: "http_request",
            config: { headers: [{ name: "Authorization", secret: true, isSet: true }] },
          },
        ],
      });
    }
  });

  test("answers unknown for a run with neither a version nor a saved draft", async () => {
    mocks.runFindFirst.mockResolvedValue({ testRunDefinition: null, workflowVersion: null });

    const response = await get();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ source: "unknown", definition: null });
  });

  test("refuses a run of another workflow or workspace like an unknown id", async () => {
    mocks.runFindFirst.mockResolvedValue(null);

    const response = await get();

    // The same generic answer an unknown workflow id gets, so a run id from elsewhere leaks nothing.
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "forbidden",
      detail: "You are not authorized to access this resource",
    });
  });

  test("rejects a malformed run id before reading anything", async () => {
    expect((await get("not-a-cuid")).status).toBe(400);
    expect(mocks.runFindFirst).not.toHaveBeenCalled();
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
    expect(mocks.runFindFirst).not.toHaveBeenCalled();
  });

  test("needs read access to the workflow's workspace", async () => {
    mocks.requireV3WorkspaceAccess.mockResolvedValue(
      Response.json(
        { code: "forbidden" },
        { status: 403, headers: { "Content-Type": "application/problem+json" } }
      )
    );

    expect((await get()).status).toBe(403);
    expect(mocks.requireV3WorkspaceAccess.mock.calls[0][2]).toBe("read");
    expect(mocks.runFindFirst).not.toHaveBeenCalled();
  });
});
