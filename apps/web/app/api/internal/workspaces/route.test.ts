import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  InvalidInputError,
  OperationNotAllowedError,
  TooManyRequestsError,
  ValidationError,
} from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  getWorkspacesByUserId: vi.fn(),
  getWritableWorkspacesByUserId: vi.fn(),
  getOrganization: vi.fn(),
  getOrganizationWorkspacesLimit: vi.fn(),
  getOrganizationWorkspacesCount: vi.fn(),
  getAccessControlPermission: vi.fn(),
  createWorkspace: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  capturePostHogEvent: vi.fn(),
  groupIdentifyPostHog: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  getMembershipByUserIdOrganizationId: vi.fn(),
  listDashboardViewerWorkspaces: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/app/(app)/workspaces/[workspaceId]/lib/workspace", () => ({
  getWorkspacesByUserId: mocks.getWorkspacesByUserId,
  getWritableWorkspacesByUserId: mocks.getWritableWorkspacesByUserId,
}));
vi.mock("@/lib/organization/service", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: mocks.getMembershipByUserIdOrganizationId,
}));
vi.mock("@/modules/ee/analysis/lib/dashboard-viewer-access", () => ({
  listDashboardViewerWorkspaces: mocks.listDashboardViewerWorkspaces,
}));
vi.mock("@/lib/workspace/service", () => ({
  getWorkspace: vi.fn(),
  getOrganizationWorkspacesCount: mocks.getOrganizationWorkspacesCount,
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getAccessControlPermission: mocks.getAccessControlPermission,
  getOrganizationWorkspacesLimit: mocks.getOrganizationWorkspacesLimit,
  getRemoveBrandingPermission: vi.fn(),
}));
vi.mock("@/modules/workspaces/settings/lib/workspace", () => ({
  createWorkspace: mocks.createWorkspace,
  updateWorkspace: vi.fn(),
  deleteWorkspaceIfNotLast: vi.fn(),
}));
vi.mock("@/modules/workspaces/settings/general/lib/delete-workspace", () => ({
  resolvePostWorkspaceDeletionDestination: vi.fn(),
}));
vi.mock("@/lib/user/service", () => ({ getUser: mocks.getUser, updateUser: mocks.updateUser }));
vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: mocks.capturePostHogEvent,
  groupIdentifyPostHog: mocks.groupIdentifyPostHog,
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    status: "failure",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock("server-only", () => ({}));

const ORG_ID = "clorg11111111111111111111";
const OTHER_ORG_ID = "clorg22222222222222222222";
const USER_ID = "cluser1111111111111111111";
const WORKSPACE_ID = "clws111111111111111111111";
const TEAM_ID = "clteam1111111111111111111";
const STATE_MUTATION_NAMESPACE = "action:state-mutation";

const createdWorkspace = {
  id: WORKSPACE_ID,
  name: "New Workspace",
  organizationId: ORG_ID,
  styling: { allowStyleOverwrite: true },
  config: { channel: null, industry: null },
  languages: [{ code: "en-US" }],
  customHeadScripts: null,
};

const BASE_URL = "http://localhost/api/internal/workspaces";

const list = (query = `organizationId=${ORG_ID}`) =>
  GET(new NextRequest(`${BASE_URL}?${query}`), { params: Promise.resolve({}) } as never);

const create = (
  body: unknown = { name: "  New Workspace  " },
  { query = `organizationId=${ORG_ID}`, headers }: { query?: string; headers?: Record<string, string> } = {}
) =>
  POST(
    new NextRequest(`${BASE_URL}?${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(headers ?? SAME_ORIGIN_HEADERS) },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) } as never
  );

/** Grant exactly these actions, on this organization only. */
const allow = (...actions: string[]) =>
  mocks.can.mockImplementation(
    async (_actor: unknown, action: string, resource: { id: string }) =>
      resource.id === ORG_ID && actions.includes(action)
  );

const checks = () => mocks.can.mock.calls.map(([actor, action, resource]) => ({ actor, action, resource }));
const auditEvent = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];
const stateMutationCalls = () =>
  mocks.applyRateLimit.mock.calls.filter(([config]) => config.namespace === STATE_MUTATION_NAMESPACE);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.getMembershipByUserIdOrganizationId.mockResolvedValue({ role: "owner" });
  mocks.listDashboardViewerWorkspaces.mockResolvedValue([]);
  allow("organization.read", "organization.read_access", "organization.manage");
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getWorkspacesByUserId.mockResolvedValue([
    { id: WORKSPACE_ID, name: "Readable", organizationId: ORG_ID },
  ]);
  mocks.getWritableWorkspacesByUserId.mockResolvedValue([{ id: WORKSPACE_ID, name: "Writable" }]);
  mocks.getOrganization.mockResolvedValue({ id: ORG_ID, name: "Acme" });
  mocks.getOrganizationWorkspacesLimit.mockResolvedValue(3);
  mocks.getOrganizationWorkspacesCount.mockResolvedValue(1);
  mocks.getAccessControlPermission.mockResolvedValue(true);
  mocks.createWorkspace.mockResolvedValue(createdWorkspace);
  mocks.getUser.mockResolvedValue({
    id: USER_ID,
    notificationSettings: { alert: { clsurvey11111111111111111: true }, unsubscribedOrganizationIds: [] },
  });
  mocks.updateUser.mockResolvedValue({});
});

describe("GET /api/internal/workspaces", () => {
  test("lists a Dashboard viewer's granted workspaces, without the organization.read it lacks", async () => {
    allow();
    mocks.getMembershipByUserIdOrganizationId.mockResolvedValue({ role: "dashboard_viewer" });
    mocks.listDashboardViewerWorkspaces.mockResolvedValue([{ id: WORKSPACE_ID, name: "Granted" }]);

    const response = await list();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([{ id: WORKSPACE_ID, name: "Granted" }]);
    expect(mocks.listDashboardViewerWorkspaces).toHaveBeenCalledWith(USER_ID, ORG_ID);
    expect(mocks.getWorkspacesByUserId).not.toHaveBeenCalled();
  });

  test("gives a Dashboard viewer no write list: that still needs organization.read_access", async () => {
    allow();
    mocks.getMembershipByUserIdOrganizationId.mockResolvedValue({ role: "dashboard_viewer" });

    expect((await list(`organizationId=${ORG_ID}&access=write`)).status).toBe(403);
    expect(mocks.listDashboardViewerWorkspaces).not.toHaveBeenCalled();
  });

  test("lists the caller's workspaces in the organization for any member, as id and name only", async () => {
    const response = await list();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([{ id: WORKSPACE_ID, name: "Readable" }]);
    expect(checks()).toEqual([
      {
        actor: { type: "user", id: USER_ID },
        action: "organization.read",
        resource: { type: "organization", id: ORG_ID },
      },
    ]);
    expect(mocks.getWorkspacesByUserId).toHaveBeenCalledWith(USER_ID, ORG_ID);
    expect(mocks.getWritableWorkspacesByUserId).not.toHaveBeenCalled();
  });

  test("lists only writable workspaces for access=write, gated on read_access", async () => {
    const response = await list(`organizationId=${ORG_ID}&access=write`);

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([{ id: WORKSPACE_ID, name: "Writable" }]);
    expect(checks().map(({ action }) => action)).toEqual(["organization.read_access"]);
    expect(mocks.getWritableWorkspacesByUserId).toHaveBeenCalledWith(USER_ID, ORG_ID);
    expect(mocks.getWorkspacesByUserId).not.toHaveBeenCalled();
  });

  test("refuses a billing member the writable list with 403, though it may read the switcher list", async () => {
    allow("organization.read");

    expect((await list(`organizationId=${ORG_ID}&access=write`)).status).toBe(403);
    expect(mocks.getWritableWorkspacesByUserId).not.toHaveBeenCalled();
    expect((await list()).status).toBe(200);
  });

  test("refuses another organization's id with 403, and lists nothing", async () => {
    expect((await list(`organizationId=${OTHER_ORG_ID}`)).status).toBe(403);
    expect((await list(`organizationId=${OTHER_ORG_ID}&access=write`)).status).toBe(403);
    expect(mocks.getWorkspacesByUserId).not.toHaveBeenCalled();
    expect(mocks.getWritableWorkspacesByUserId).not.toHaveBeenCalled();
  });

  test.each([
    ["no organization", ""],
    ["a malformed organization id", "organizationId=not a cuid"],
    ["an unknown access level", `organizationId=${ORG_ID}&access=manage`],
    ["an unknown parameter", `organizationId=${ORG_ID}&workspaceId=${WORKSPACE_ID}`],
  ])("answers 400 for %s", async (_label, query) => {
    expect((await list(query)).status).toBe(400);
    expect(mocks.can).not.toHaveBeenCalled();
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await list()).status).toBe(401);
    expect(mocks.getWorkspacesByUserId).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/workspaces", () => {
  test.each([["inAppSurveyBranding"], ["linkSurveyBranding"]])(
    "refuses %s at creation with 400, so no create stores branding the licence gate would refuse (ENG-6840)",
    async (field) => {
      expect((await create({ name: "New Workspace", [field]: false })).status).toBe(400);
      expect(mocks.createWorkspace).not.toHaveBeenCalled();
    }
  );

  test("lets an owner or manager create a workspace, audits it, and answers its id and name only", async () => {
    const response = await create({ name: "  New Workspace  ", teamIds: [TEAM_ID] });

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/internal/workspaces/${WORKSPACE_ID}`);
    expect((await response.json()).data).toEqual({ id: WORKSPACE_ID, name: "New Workspace" });
    expect(checks()).toEqual([
      {
        actor: { type: "user", id: USER_ID },
        action: "organization.manage",
        resource: { type: "organization", id: ORG_ID },
      },
    ]);
    expect(mocks.createWorkspace).toHaveBeenCalledWith(
      ORG_ID,
      { name: "New Workspace", teamIds: [TEAM_ID] },
      { workspaceLimit: 3 }
    );
    expect(auditEvent()).toMatchObject({
      action: "created",
      targetType: "workspace",
      status: "success",
      organizationId: ORG_ID,
      targetId: WORKSPACE_ID,
      newObject: expect.objectContaining({ id: WORKSPACE_ID, name: "New Workspace" }),
    });
    expect(mocks.updateUser).toHaveBeenCalledWith(USER_ID, {
      notificationSettings: {
        alert: { clsurvey11111111111111111: true },
        unsubscribedOrganizationIds: [],
      },
    });
    expect(mocks.groupIdentifyPostHog).toHaveBeenCalledWith("workspace", WORKSPACE_ID, {
      name: "New Workspace",
    });
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "workspace_created",
      { organization_id: ORG_ID, workspace_id: WORKSPACE_ID, name: "New Workspace" },
      { organizationId: ORG_ID, workspaceId: WORKSPACE_ID }
    );
  });

  test("creates a workspace without teams, and asks nothing of the access-control licence", async () => {
    expect((await create({ name: "Solo" })).status).toBe(201);
    expect(mocks.createWorkspace).toHaveBeenCalledWith(
      ORG_ID,
      { name: "Solo", teamIds: [] },
      { workspaceLimit: 3 }
    );
    expect(mocks.getAccessControlPermission).not.toHaveBeenCalled();
  });

  test("refuses a member without organization.manage with 403, and audits the refusal against the organization", async () => {
    allow("organization.read", "organization.read_access");

    expect((await create()).status).toBe(403);
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
    expect(stateMutationCalls()).toEqual([]);
    expect(auditEvent()).toMatchObject({
      action: "created",
      targetType: "workspace",
      status: "failure",
      organizationId: ORG_ID,
    });
  });

  test("refuses another organization's id with 403, and creates nothing", async () => {
    expect((await create(undefined, { query: `organizationId=${OTHER_ORG_ID}` })).status).toBe(403);
    expect(mocks.getOrganization).not.toHaveBeenCalled();
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
  });

  test("answers 403 for an organization that is gone after authorization", async () => {
    mocks.getOrganization.mockResolvedValue(null);

    expect((await create()).status).toBe(403);
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
  });

  test("charges the state-mutation budget to the organization, and answers 429 when it is spent", async () => {
    expect((await create()).status).toBe(201);
    expect(stateMutationCalls()).toEqual([[expect.anything(), ORG_ID]]);

    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === STATE_MUTATION_NAMESPACE) throw new TooManyRequestsError("Slow down", 30);
    });
    const limited = await create();

    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("30");
    expect(mocks.createWorkspace).toHaveBeenCalledTimes(1);
  });

  test("refuses a workspace past the plan's limit with 403, before the transaction", async () => {
    mocks.getOrganizationWorkspacesCount.mockResolvedValue(3);

    const response = await create();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Organization workspace limit reached");
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
  });

  test("answers 403 when a concurrent create reached the limit first, under the lock", async () => {
    mocks.createWorkspace.mockRejectedValue(
      new OperationNotAllowedError("Organization workspace limit reached")
    );

    const response = await create();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Organization workspace limit reached");
    expect(auditEvent()).toMatchObject({ status: "failure", organizationId: ORG_ID });
  });

  test("refuses assigning teams without the access-control licence", async () => {
    mocks.getAccessControlPermission.mockResolvedValue(false);

    const response = await create({ name: "Teamed", teamIds: [TEAM_ID] });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You do not have permission to manage roles");
    expect(mocks.getAccessControlPermission).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
  });

  test("answers 422 on teamIds when a team belongs to another organization", async () => {
    mocks.createWorkspace.mockRejectedValue(new ValidationError("teamIds must belong to the organization"));

    const response = await create({ name: "Teamed", teamIds: [TEAM_ID] });

    expect(response.status).toBe(422);
    expect((await response.json()).invalid_params).toEqual([
      { name: "teamIds", reason: "teamIds must belong to the organization" },
    ]);
  });

  test("answers 409 for a name another workspace in the organization has", async () => {
    mocks.createWorkspace.mockRejectedValue(
      new InvalidInputError("A workspace with this name already exists in your organization")
    );

    expect((await create()).status).toBe(409);
  });

  test.each([
    ["an empty name", { name: "   " }],
    ["an overlong name", { name: "x".repeat(256) }],
    ["a malformed team id", { name: "x", teamIds: ["not a cuid"] }],
    ["a setting the dialog doesn't send", { name: "x", inAppSurveyBranding: false }],
    ["the organization in the body", { name: "x", organizationId: OTHER_ORG_ID }],
  ])("answers 400 for %s, and creates nothing", async (_label, body) => {
    expect((await create(body)).status).toBe(400);
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
  });

  test.each([
    ["no organization", ""],
    ["a malformed organization id", "organizationId=nope nope"],
    ["an unknown parameter", `organizationId=${ORG_ID}&access=write`],
  ])("answers 400 for %s in the query", async (_label, query) => {
    expect((await create(undefined, { query })).status).toBe(400);
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await create()).status).toBe(401);
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await create(undefined, { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
  });
});
