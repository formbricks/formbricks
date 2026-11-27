import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { AuthzedError } from "@/lib/authzed/errors";
import { MCP_GRANT_NOT_SAVED_CODE } from "@/modules/auth/lib/mcp-grant-consent-errors";
import { MAX_MCP_GRANT_SELECTIONS, MAX_MCP_GRANT_SELECTION_ID_LENGTH } from "@/modules/mcp/grant";
import { DELETE, PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  isDashboardViewerOnly: vi.fn(),
  editMcpGrant: vi.fn(),
  revokeMcpClient: vi.fn(),
  queueMcpGrantAudits: vi.fn(),
  queueMcpClientRevocationAudit: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/modules/ee/analysis/lib/dashboard-viewer-access", () => ({
  isDashboardViewerOnly: mocks.isDashboardViewerOnly,
}));
vi.mock("@/modules/mcp/authorized-clients", () => ({ editMcpGrant: mocks.editMcpGrant }));
vi.mock("@/modules/auth/lib/mcp-grant-revocation", () => ({ revokeMcpClient: mocks.revokeMcpClient }));
vi.mock("@/modules/mcp/grant-audit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/mcp/grant-audit")>()),
  queueMcpGrantAudits: mocks.queueMcpGrantAudits,
  queueMcpClientRevocationAudit: mocks.queueMcpClientRevocationAudit,
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

/** Audit entries as the grant store prepares them: opaque here, passed through to the queue. */
const SAVED_AUDIT = { action: "updated", organizationIds: ["org_1"] };
const ENDED_AUDIT = { action: "deleted", organizationIds: ["org_1"] };

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

/** The grant version Edit opened, which every save sends back. */
const OPENED_AT = "2026-06-01T10:00:00.123Z";

const edit = (body: Record<string, unknown>, clientId = CLIENT_ID) =>
  PATCH(
    new NextRequest(`http://localhost/api/internal/mcp-grants/${clientId}`, {
      method: "PATCH",
      headers: { ...SAME_ORIGIN_HEADERS, "x-request-id": "req_1", "content-type": "application/json" },
      body: JSON.stringify({ expectedUpdatedAt: OPENED_AT, ...body }),
    }),
    { params: Promise.resolve({ clientId }) }
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
      audits: [SAVED_AUDIT],
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
      grant: { permissions: { surveys: "read" } },
      expectedUpdatedAt: new Date(OPENED_AT),
      isDashboardViewer: false,
    });
    // The entries the edit prepared in its transaction (one per organization the grant reaches, both
    // snapshots whole), queued as the user; the wrapper's single diffed entry is skipped.
    expect(mocks.queueMcpGrantAudits).toHaveBeenCalledWith({ userId: USER_ID, userType: "user" }, [
      SAVED_AUDIT,
    ]);
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("saves organization & workspace access with the permissions, and audits the selection", async () => {
    const audit = { ...SAVED_AUDIT, after: stored({ surveys: "read" }, ["ws_1"]) };
    mocks.editMcpGrant.mockResolvedValueOnce({
      status: "saved",
      before: stored({ surveys: "read" }),
      after: stored({ surveys: "read" }, ["ws_1"]),
      audits: [audit],
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
      expect.objectContaining({
        grant: { permissions: { surveys: "read" }, access: { access: "workspaces", workspaceIds: ["ws_1"] } },
      })
    );
    expect(mocks.queueMcpGrantAudits).toHaveBeenCalledWith(expect.anything(), [audit]);
  });

  test("holds a Dashboard viewer's edit to what a viewer may give", async () => {
    mocks.isDashboardViewerOnly.mockResolvedValue(true);

    await edit({ permissions: { dashboards: "read" } });

    expect(mocks.editMcpGrant).toHaveBeenCalledWith(expect.objectContaining({ isDashboardViewer: true }));
  });

  // Another tab or session saved the grant after Edit opened it: saving would undo that change unseen.
  test("answers 409 mcp_grant_changed, with both versions, for a grant saved since Edit opened it", async () => {
    const savedSince = new Date("2026-06-01T10:05:00.000Z");
    mocks.editMcpGrant.mockResolvedValue({ status: "changed", currentUpdatedAt: savedSince });

    const response = await edit({ permissions: { surveys: "read" } });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "mcp_grant_changed",
      detail: "This MCP client's access changed elsewhere. Reload to see it.",
      details: { expectedUpdatedAt: OPENED_AT, currentUpdatedAt: savedSince.toISOString() },
    });
    expect(mocks.queueMcpGrantAudits).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
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
    expect(await response.json()).toMatchObject({
      code: "mcp_grant_beyond_scopes",
      detail: "The grant names access this client didn't ask for.",
    });
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
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
    expect(mocks.queueMcpGrantAudits).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
  });

  // Refused by the consent screen's own parser in the operation, so the screen translates the code rather
  // than showing the server's English detail.
  test.each([
    ["an empty grant, which Revoke is for", { permissions: {} }],
    ["an unknown permission", { permissions: { everything: "write" } }],
    ["a level the permission doesn't offer", { permissions: { workflowRuns: "write" } }],
    ["No access spelled out", { permissions: { surveys: "none" } }],
    ["a selection with nothing picked", { permissions: { surveys: "read" }, access: "workspaces" }],
    ["an unknown access", { permissions: { surveys: "read" }, access: "everything" }],
  ])("returns 400 mcp_grant_invalid for %s and saves nothing", async (_case, body) => {
    const response = await edit(body);

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("mcp_grant_invalid");
    expect(mocks.editMcpGrant).not.toHaveBeenCalled();
  });

  // Bounded at the boundary (CODING_STANDARDS "Input Limits"), before the parser walks the list: both id
  // lists, at the most a grant selects and the longest id it takes.
  const ids = (count: number, prefix: string) =>
    Array.from({ length: count }, (_unused, index) => `${prefix}${index.toString()}`);
  test.each([
    [
      "more workspaces than a grant holds",
      "workspaces",
      { workspaceIds: ids(MAX_MCP_GRANT_SELECTIONS + 1, "clws") },
    ],
    [
      "more organizations than a grant holds",
      "organizations",
      { organizationIds: ids(MAX_MCP_GRANT_SELECTIONS + 1, "clorg") },
    ],
    [
      "a workspace id longer than an id can be",
      "workspaces",
      { workspaceIds: ["w".repeat(MAX_MCP_GRANT_SELECTION_ID_LENGTH + 1)] },
    ],
    [
      "an organization id longer than an id can be",
      "organizations",
      { organizationIds: ["o".repeat(MAX_MCP_GRANT_SELECTION_ID_LENGTH + 1)] },
    ],
  ])("returns 400 for %s, naming the field, and saves nothing", async (_case, access, selection) => {
    const response = await edit({ permissions: { surveys: "read" }, access, ...selection });

    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain(Object.keys(selection)[0]);
    expect(mocks.editMcpGrant).not.toHaveBeenCalled();
  });

  test("saves an id of exactly the longest length a grant takes", async () => {
    const organizationIds = ["o".repeat(MAX_MCP_GRANT_SELECTION_ID_LENGTH)];

    const response = await edit({
      permissions: { surveys: "read" },
      access: "organizations",
      organizationIds,
    });

    expect(response.status).toBe(200);
  });

  test("saves a selection of exactly as many as a grant holds", async () => {
    const workspaceIds = Array.from(
      { length: MAX_MCP_GRANT_SELECTIONS },
      (_unused, index) => `clws${index.toString().padStart(3, "0")}`
    );

    const response = await edit({ permissions: { surveys: "read" }, access: "workspaces", workspaceIds });

    expect(response.status).toBe(200);
    expect(mocks.editMcpGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        grant: { permissions: { surveys: "read" }, access: { access: "workspaces", workspaceIds } },
      })
    );
  });

  test.each([
    ["no permissions", {}],
    ["no grant version", { permissions: { surveys: "read" }, expectedUpdatedAt: undefined }],
    [
      "a grant version that isn't a date",
      { permissions: { surveys: "read" }, expectedUpdatedAt: "yesterday" },
    ],
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
      headers: { ...SAME_ORIGIN_HEADERS, "x-request-id": "req_1" },
    }),
    { params: Promise.resolve({ clientId }) }
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
      grantAudits: [ENDED_AUDIT],
    });

    const response = await revoke();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ clientId: CLIENT_ID });
    expect(mocks.revokeMcpClient).toHaveBeenCalledWith({ userId: USER_ID, clientId: CLIENT_ID });
    // The entries the revoke prepared in its transaction, queued as the user.
    expect(mocks.queueMcpGrantAudits).toHaveBeenCalledWith({ userId: USER_ID, userType: "user" }, [
      ENDED_AUDIT,
    ]);
    // The grant store files the entries; the wrapper's own entry is skipped.
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  // A consent left without a grant (written by the previous release during a rolling upgrade): no grant
  // entry to write, so the client is the target, with what was ended, instead of the route's entry, which
  // could name neither.
  test("audits a revoke that ended a consent and no grant with the client and what was ended", async () => {
    mocks.revokeMcpClient.mockResolvedValue({
      consentsDeleted: 1,
      refreshTokensRevoked: 2,
      accessTokensRevoked: 0,
      grants: [],
      grantAudits: [],
    });

    const response = await revoke();

    expect(response.status).toBe(200);
    expect(mocks.queueMcpGrantAudits).toHaveBeenCalledWith(expect.anything(), []);
    expect(mocks.queueMcpClientRevocationAudit).toHaveBeenCalledWith({
      actorUserId: USER_ID,
      clientId: CLIENT_ID,
      ended: { consentsDeleted: 1, refreshTokensRevoked: 2, accessTokensRevoked: 0 },
    });
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("answers 403 for a client the user has nothing for, like another user's", async () => {
    mocks.revokeMcpClient.mockResolvedValue(null);

    const response = await revoke("someone-elses-client");

    expect(response.status).toBe(403);
    expect(mocks.queueMcpGrantAudits).not.toHaveBeenCalled();
  });

  test("returns 401 without a session and revokes nothing", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await revoke()).status).toBe(401);
    expect(mocks.revokeMcpClient).not.toHaveBeenCalled();
  });
});

describe("cross-origin writes to /api/internal/mcp-grants/{clientId}", () => {
  // The session cookie rides along on a cross-site request, so the origin check is what keeps another site
  // from editing or revoking the user's MCP access.
  const CROSS_SITE = { "sec-fetch-site": "cross-site", origin: "https://evil.example" };

  beforeEach(() => {
    vi.clearAllMocks();
    // A signed-in user, so the refusal is the origin check's and not a missing session.
    mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.queueAuditEvent.mockResolvedValue(undefined);
  });

  test("refuses a cross-site edit with 403 and saves nothing", async () => {
    const response = await PATCH(
      new NextRequest(`http://localhost/api/internal/mcp-grants/${CLIENT_ID}`, {
        method: "PATCH",
        headers: { ...CROSS_SITE, "content-type": "application/json" },
        body: JSON.stringify({ expectedUpdatedAt: OPENED_AT, permissions: { surveys: "read" } }),
      }),
      { params: Promise.resolve({ clientId: CLIENT_ID }) }
    );

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Cross-origin requests are not allowed.");
    expect(mocks.editMcpGrant).not.toHaveBeenCalled();
  });

  test("refuses a cross-site revoke with 403 and revokes nothing", async () => {
    const response = await DELETE(
      new NextRequest(`http://localhost/api/internal/mcp-grants/${CLIENT_ID}`, {
        method: "DELETE",
        headers: CROSS_SITE,
      }),
      { params: Promise.resolve({ clientId: CLIENT_ID }) }
    );

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Cross-origin requests are not allowed.");
    expect(mocks.revokeMcpClient).not.toHaveBeenCalled();
  });
});
