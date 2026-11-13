import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthzedError } from "@/lib/authzed/errors";
import { MCP_GRANT_NOT_SAVED_CODE } from "@/modules/auth/lib/mcp-grant-consent-errors";
import { DELETE, PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  isDashboardViewerOnly: vi.fn(),
  editMcpGrant: vi.fn(),
  revokeMcpClient: vi.fn(),
  queueMcpGrantAudit: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/modules/ee/analysis/lib/dashboard-viewer-access", () => ({
  isDashboardViewerOnly: mocks.isDashboardViewerOnly,
}));
vi.mock("@/modules/mcp/authorized-clients", () => ({ editMcpGrant: mocks.editMcpGrant }));
vi.mock("@/modules/auth/lib/oauth-grant-revocation", () => ({ revokeMcpClient: mocks.revokeMcpClient }));
vi.mock("@/modules/mcp/grant-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/mcp/grant-store")>()),
  queueMcpGrantAudit: mocks.queueMcpGrantAudit,
}));
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
    // The grant store writes the entries (one per organization the grant reaches, both snapshots
    // whole); the wrapper's single diffed entry is skipped.
    expect(mocks.queueMcpGrantAudit).toHaveBeenCalledWith({
      action: "updated",
      actorUserId: USER_ID,
      before: stored({ surveys: "write", responses: "read" }),
      after: stored({ surveys: "read" }),
    });
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
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
    expect(mocks.queueMcpGrantAudit).toHaveBeenCalledWith(
      expect.objectContaining({ after: stored({ surveys: "read" }, ["ws_1"]) })
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

  test("refuses with 422 an organization or workspace the user can't pick, rather than saving it as none", async () => {
    mocks.editMcpGrant.mockResolvedValueOnce({ status: "selection_unavailable", field: "workspaceIds" });

    const response = await edit({
      permissions: { surveys: "read" },
      access: "workspaces",
      workspaceIds: ["clstranger11111111111111"],
    });

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("mcp_grant_selection_unavailable");
    expect(body.detail).toBe("Pick only workspaces you have access to.");
    expect(body.invalid_params).toEqual([
      { name: "workspaceIds", reason: "Pick only workspaces you have access to" },
    ]);
  });

  // SpiceDB down during a narrowing (smoke): the same refusal and message the consent screen gives, not
  // the wrapper's generic 500. Any other failure of the save answers the same: nothing was saved.
  test.each([
    [
      "SpiceDB can't apply the narrowing",
      new AuthzedError({ attempts: 3, code: "authzed_internal", operation: "write", retryable: false }),
    ],
    ["the save's transaction fails", new Error("transaction timed out")],
  ])("answers 500 mcp_grant_not_saved when %s, and audits the failure", async (_case, failure) => {
    mocks.editMcpGrant.mockRejectedValueOnce(failure);

    const response = await edit({
      permissions: { surveys: "read" },
      access: "workspaces",
      workspaceIds: ["clworkspace1111111111111"],
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe(MCP_GRANT_NOT_SAVED_CODE);
    expect(body.detail).toBe("The access you chose couldn't be saved, so nothing changed. Try again.");
    expect(mocks.queueMcpGrantAudit).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
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

const revoke = (clientId = CLIENT_ID) =>
  DELETE(
    new NextRequest(`http://localhost/api/internal/mcp-grants/${clientId}`, {
      method: "DELETE",
      headers: { "x-request-id": "req_1" },
    }),
    { params: Promise.resolve({ clientId }) } as never
  );

describe("DELETE /api/internal/mcp-grants/{clientId}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.queueAuditEvent.mockResolvedValue(undefined);
  });

  test("revokes the session user's own client and audits each grant it ended, as the user", async () => {
    const grant = stored({ surveys: "read" }, ["clws11111111111111111111"]);
    mocks.revokeMcpClient.mockResolvedValue({
      consentsDeleted: 0,
      refreshTokensRevoked: 1,
      accessTokensRevoked: 0,
      grants: [grant],
    });

    const response = await revoke();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ clientId: CLIENT_ID });
    expect(mocks.revokeMcpClient).toHaveBeenCalledWith({ userId: USER_ID, clientId: CLIENT_ID });
    expect(mocks.queueMcpGrantAudit).toHaveBeenCalledWith({
      action: "deleted",
      actorUserId: USER_ID,
      before: grant,
      after: null,
    });
    // The grant store files the entries; the wrapper's own entry is skipped.
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("answers 403 for a client the user has nothing for, like another user's", async () => {
    mocks.revokeMcpClient.mockResolvedValue(null);

    const response = await revoke("someone-elses-client");

    expect(response.status).toBe(403);
    expect(mocks.queueMcpGrantAudit).not.toHaveBeenCalled();
  });

  test("returns 401 without a session and revokes nothing", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await revoke()).status).toBe(401);
    expect(mocks.revokeMcpClient).not.toHaveBeenCalled();
  });
});
