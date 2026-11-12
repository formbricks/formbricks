import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  isDashboardViewerOnly: vi.fn(),
  editMcpGrant: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/modules/ee/analysis/lib/dashboard-viewer-access", () => ({
  isDashboardViewerOnly: mocks.isDashboardViewerOnly,
}));
vi.mock("@/modules/mcp/connections", () => ({ editMcpGrant: mocks.editMcpGrant }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    organizationId: "unknown",
    targetId: "unknown",
    status: "failure",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const CLIENT_ID = "QhXbTnRZsWzKfLpAeVcMdYuJ";
const GRANT_ID = "clgrant111111111111111111";

const stored = (permissions: Record<string, string>, workspaceIds?: string[]) => ({
  id: GRANT_ID,
  userId: USER_ID,
  clientId: CLIENT_ID,
  permissions,
  ...(workspaceIds ? { access: "workspaces", workspaceIds } : { access: "all" }),
});

const edit = (body: unknown, clientId = CLIENT_ID) =>
  PATCH(
    new NextRequest(`http://localhost/api/internal/mcp-grants/${clientId}`, {
      method: "PATCH",
      headers: { "x-request-id": "req_1", "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ clientId }) } as never
  );

describe("PATCH /api/internal/mcp-grants/{clientId}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.isDashboardViewerOnly.mockResolvedValue(false);
    mocks.queueAuditEvent.mockResolvedValue(undefined);
    mocks.editMcpGrant.mockResolvedValue({
      status: "saved",
      before: stored({ surveys: "write", responses: "read" }),
      after: stored({ surveys: "read" }),
    });
  });

  test("saves the session user's own grant and audits the user, the client and the grant before and after", async () => {
    const response = await edit({ permissions: { surveys: "read" } });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      clientId: CLIENT_ID,
      permissions: { surveys: "read" },
      access: { access: "all" },
    });
    expect(mocks.editMcpGrant).toHaveBeenCalledWith({
      userId: USER_ID,
      clientId: CLIENT_ID,
      permissions: { surveys: "read" },
      isDashboardViewer: false,
    });
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "mcpGrant",
        targetId: GRANT_ID,
        userId: USER_ID,
        userType: "user",
        status: "success",
        oldObject: {
          clientId: CLIENT_ID,
          access: "all",
          permissions: { surveys: "write", responses: "read" },
        },
        newObject: { clientId: CLIENT_ID, access: "all", permissions: { surveys: "read" } },
      })
    );
  });

  test("saves organization & workspace access with the permissions, and audits the selection", async () => {
    mocks.editMcpGrant.mockResolvedValueOnce({
      status: "saved",
      before: stored({ surveys: "read" }),
      after: stored({ surveys: "read" }, ["ws_1"]),
    });

    const response = await edit({
      permissions: { surveys: "read" },
      access: "workspaces",
      workspaceIds: ["ws_1"],
    });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({
      access: { access: "workspaces", workspaceIds: ["ws_1"] },
    });
    expect(mocks.editMcpGrant).toHaveBeenCalledWith(
      expect.objectContaining({ access: { access: "workspaces", workspaceIds: ["ws_1"] } })
    );
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        newObject: {
          clientId: CLIENT_ID,
          access: "workspaces",
          workspaceIds: ["ws_1"],
          permissions: { surveys: "read" },
        },
      })
    );
  });

  test("holds a Dashboard viewer's edit to what a viewer may give", async () => {
    mocks.isDashboardViewerOnly.mockResolvedValue(true);

    await edit({ permissions: { dashboards: "read" } });

    expect(mocks.editMcpGrant).toHaveBeenCalledWith(expect.objectContaining({ isDashboardViewer: true }));
  });

  test("answers a client the user never connected, or another user's, with 403", async () => {
    mocks.editMcpGrant.mockResolvedValueOnce({ status: "not_found" });

    const response = await edit({ permissions: { surveys: "read" } });

    expect(response.status).toBe(403);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
  });

  test("refuses a level above the client's scopes with 422 instead of capping it", async () => {
    mocks.editMcpGrant.mockResolvedValueOnce({ status: "beyond_scopes" });

    const response = await edit({ permissions: { workflows: "write" } });

    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("mcp_grant_beyond_scopes");
  });

  test.each([
    ["an empty grant, which Revoke is for", { permissions: {} }],
    ["an unknown permission", { permissions: { everything: "write" } }],
    ["a level the permission doesn't offer", { permissions: { workflowRuns: "write" } }],
    ["No access spelled out", { permissions: { surveys: "none" } }],
    ["a selection with nothing picked", { permissions: { surveys: "read" }, access: "workspaces" }],
    ["an unknown access", { permissions: { surveys: "read" }, access: "everything" }],
    ["no permissions", {}],
  ])("returns 400 for %s and saves nothing", async (_case, body) => {
    expect((await edit(body)).status).toBe(400);
    expect(mocks.editMcpGrant).not.toHaveBeenCalled();
  });

  test("returns 401 without a session and saves nothing", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await edit({ permissions: { surveys: "read" } })).status).toBe(401);
    expect(mocks.editMcpGrant).not.toHaveBeenCalled();
  });
});
