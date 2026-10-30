import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError, OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { DELETE, GET, PATCH } from "./[teamId]/route";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  getTeam: vi.fn(),
  checkRoleManagementPermission: vi.fn(),
  createTeam: vi.fn(),
  getTeamDetails: vi.fn(),
  updateTeamDetails: vi.fn(),
  deleteTeam: vi.fn(),
  getTeamRoleByTeamIdUserId: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/utils/services", () => ({ getTeam: mocks.getTeam }));
vi.mock("@/modules/ee/role-management/lib/permission", () => ({
  checkRoleManagementPermission: mocks.checkRoleManagementPermission,
}));
vi.mock("@/modules/ee/teams/team-list/lib/team", () => ({
  createTeam: mocks.createTeam,
  getTeamDetails: mocks.getTeamDetails,
  updateTeamDetails: mocks.updateTeamDetails,
  deleteTeam: mocks.deleteTeam,
}));
vi.mock("@/modules/ee/teams/lib/roles", () => ({
  getTeamRoleByTeamIdUserId: mocks.getTeamRoleByTeamIdUserId,
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    status: "failure",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const ORG_ID = "clorg11111111111111111111";
const OTHER_ORG_ID = "clorg22222222222222222222";
const USER_ID = "cluser1111111111111111111";
const TEAM_ID = "clteam1111111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const OTHER_WORKSPACE_ID = "clwork2222222222222222222";

const team = (overrides: Record<string, unknown> = {}) => ({
  id: TEAM_ID,
  name: "Team",
  organizationId: ORG_ID,
  members: [{ userId: USER_ID, name: "User", role: "admin" }],
  workspaces: [{ workspaceId: WORKSPACE_ID, workspaceName: "Workspace", permission: "read" }],
  ...overrides,
});

/** The settings form as the modal submits it: the full member and grant lists. */
const updateBody = (overrides: Record<string, unknown> = {}) => ({
  name: "Renamed",
  members: [{ userId: USER_ID, role: "admin" }],
  workspaces: [{ workspaceId: WORKSPACE_ID, permission: "read" }],
  ...overrides,
});

type THeaders = Record<string, string>;
const sameOrigin = SAME_ORIGIN_HEADERS as THeaders;

const teamsUrl = (organizationId = ORG_ID) =>
  `http://localhost/api/internal/teams?organizationId=${organizationId}`;
const teamUrl = (id = TEAM_ID) => `http://localhost/api/internal/teams/${id}`;
const props = (id = TEAM_ID) => ({ params: Promise.resolve({ teamId: id }) });

const create = (
  body: unknown,
  { organizationId = ORG_ID, headers = sameOrigin }: { organizationId?: string; headers?: THeaders } = {}
) =>
  POST(
    new NextRequest(teamsUrl(organizationId), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    {} as never
  );

const read = (id = TEAM_ID) => GET(new NextRequest(teamUrl(id), { method: "GET" }), props(id) as never);

const update = (body: unknown, { id = TEAM_ID, headers = sameOrigin } = {}) =>
  PATCH(
    new NextRequest(teamUrl(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    props(id) as never
  );

const remove = ({ id = TEAM_ID, headers = sameOrigin } = {}) =>
  DELETE(new NextRequest(teamUrl(id), { method: "DELETE", headers }), props(id) as never);

/** Grant exactly these actions, on any resource. */
const allow = (...actions: string[]) =>
  mocks.can.mockImplementation(async (_actor: unknown, action: string) => actions.includes(action));

const checkedActions = () => mocks.can.mock.calls.map(([, action]) => action);

const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  allow("organization.manage", "team.manage", "team.delete");
  mocks.getTeam.mockResolvedValue({ organizationId: ORG_ID });
  mocks.checkRoleManagementPermission.mockResolvedValue(undefined);
  mocks.createTeam.mockResolvedValue(TEAM_ID);
  mocks.getTeamDetails.mockResolvedValue(team());
  mocks.updateTeamDetails.mockResolvedValue(true);
  mocks.deleteTeam.mockResolvedValue(true);
  mocks.getTeamRoleByTeamIdUserId.mockResolvedValue("admin");
});

describe("POST /api/internal/teams", () => {
  test("lets an owner or manager create a team, answers 201 with it, and audits the creation", async () => {
    const response = await create({ name: "  Team  " });

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/internal/teams/${TEAM_ID}`);
    expect((await response.json()).data).toEqual(team());
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(checkedActions()).toEqual(["organization.manage"]);
    expect(mocks.createTeam).toHaveBeenCalledWith(ORG_ID, "Team");
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "created",
        targetType: "team",
        status: "success",
        organizationId: ORG_ID,
        targetId: TEAM_ID,
        newObject: team(),
      })
    );
  });

  test("checks the licence only after authorizing the caller", async () => {
    const callOrder: string[] = [];
    mocks.can.mockImplementation(async () => {
      callOrder.push("authorize");
      return true;
    });
    mocks.checkRoleManagementPermission.mockImplementation(async () => {
      callOrder.push("entitlement");
    });

    expect((await create({ name: "Team" })).status).toBe(201);
    expect(callOrder).toEqual(["authorize", "entitlement"]);
    expect(mocks.checkRoleManagementPermission).toHaveBeenCalledWith(ORG_ID);
  });

  test("refuses a member with 403, checks no licence, and audits the refusal against the organization", async () => {
    allow("team.manage");
    expect((await create({ name: "Team" })).status).toBe(403);
    expect(mocks.checkRoleManagementPermission).not.toHaveBeenCalled();
    expect(mocks.createTeam).not.toHaveBeenCalled();
    expect(lastAudit()).toEqual(
      expect.objectContaining({ action: "created", status: "failure", organizationId: ORG_ID })
    );
  });

  test("asks about the organization the caller named, and refuses one they don't manage", async () => {
    mocks.can.mockImplementation(
      async (_actor: unknown, _action: string, resource: { id: string }) => resource.id === ORG_ID
    );
    expect((await create({ name: "Team" }, { organizationId: OTHER_ORG_ID })).status).toBe(403);
    expect(mocks.can).toHaveBeenCalledWith(expect.anything(), "organization.manage", {
      type: "organization",
      id: OTHER_ORG_ID,
    });
    expect(mocks.createTeam).not.toHaveBeenCalled();
  });

  test("refuses with the licence's reason when the organization has no role management", async () => {
    mocks.checkRoleManagementPermission.mockRejectedValue(
      new OperationNotAllowedError("Role management is not allowed for this organization")
    );
    const response = await create({ name: "Team" });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Role management is not allowed for this organization");
    expect(mocks.createTeam).not.toHaveBeenCalled();
  });

  test("answers the plain 403 when the organization is gone by the licence check", async () => {
    mocks.checkRoleManagementPermission.mockRejectedValue(new ResourceNotFoundError("Organization", ORG_ID));
    const response = await create({ name: "Team" });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
  });

  test("answers 409 with the reason when a team with that name already exists", async () => {
    mocks.createTeam.mockRejectedValue(new InvalidInputError("Team name already exists"));
    const response = await create({ name: "Team" });

    expect(response.status).toBe(409);
    expect((await response.json()).detail).toBe("Team name already exists");
  });

  test.each([
    ["a blank name", { name: "   " }],
    ["no name", {}],
    ["a name over 255 characters", { name: "x".repeat(256) }],
    ["an unknown field", { name: "Team", organizationId: OTHER_ORG_ID }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await create(body)).status).toBe(400);
    expect(mocks.createTeam).not.toHaveBeenCalled();
  });

  test("answers 400 for a malformed organization id", async () => {
    expect((await create({ name: "Team" }, { organizationId: "not a cuid" })).status).toBe(400);
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await create({ name: "Team" })).status).toBe(401);
    expect(mocks.createTeam).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await create({ name: "Team" }, { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(
      403
    );
    expect(mocks.createTeam).not.toHaveBeenCalled();
  });
});

describe("GET /api/internal/teams/{teamId}", () => {
  test("returns the team and the caller's role in it, behind team.manage on that team", async () => {
    const response = await read();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ ...team(), currentUserRole: "admin" });
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "team.manage", {
      type: "team",
      id: TEAM_ID,
    });
    expect(checkedActions()).toEqual(["team.manage"]);
    expect(mocks.checkRoleManagementPermission).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.getTeamRoleByTeamIdUserId).toHaveBeenCalledWith(TEAM_ID, USER_ID);
  });

  test("returns a null role for an owner who isn't in the team", async () => {
    mocks.getTeamRoleByTeamIdUserId.mockResolvedValue(null);
    expect((await (await read()).json()).data.currentUserRole).toBeNull();
  });

  test("refuses a caller without team.manage with 403, and reads nothing", async () => {
    allow("organization.manage");
    expect((await read()).status).toBe(403);
    expect(mocks.getTeamDetails).not.toHaveBeenCalled();
    expect(mocks.checkRoleManagementPermission).not.toHaveBeenCalled();
  });

  test("answers 403 for a team that does not exist, the same as for one the caller can't see", async () => {
    mocks.getTeam.mockResolvedValue(null);
    const response = await read();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.can).not.toHaveBeenCalled();
  });

  test("checks the licence of the organization the team belongs to", async () => {
    mocks.getTeam.mockResolvedValue({ organizationId: OTHER_ORG_ID });
    mocks.checkRoleManagementPermission.mockRejectedValue(
      new OperationNotAllowedError("Role management is not allowed for this organization")
    );

    expect((await read()).status).toBe(403);
    expect(mocks.checkRoleManagementPermission).toHaveBeenCalledWith(OTHER_ORG_ID);
    expect(mocks.getTeamDetails).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/internal/teams/{teamId}", () => {
  test("lets a team admin change members while sending the workspace grants back unchanged", async () => {
    allow("team.manage");
    mocks.getTeamDetails.mockResolvedValueOnce(team()).mockResolvedValueOnce(team({ name: "Renamed" }));
    const response = await update(updateBody());

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(team({ name: "Renamed" }));
    expect(checkedActions()).toEqual(["team.manage"]);
    expect(mocks.updateTeamDetails).toHaveBeenCalledWith(TEAM_ID, updateBody());
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "updated",
        targetType: "team",
        status: "success",
        organizationId: ORG_ID,
        targetId: TEAM_ID,
        oldObject: team(),
        newObject: team({ name: "Renamed" }),
      })
    );
  });

  test.each([
    [
      "adds a workspace",
      [...updateBody().workspaces, { workspaceId: OTHER_WORKSPACE_ID, permission: "read" }],
    ],
    ["raises a permission", [{ workspaceId: WORKSPACE_ID, permission: "manage" }]],
    ["removes a workspace and adds another", [{ workspaceId: OTHER_WORKSPACE_ID, permission: "read" }]],
  ])(
    "refuses a team admin who %s, since that needs organization.manage, and writes nothing",
    async (_label, workspaces) => {
      allow("team.manage");
      const response = await update(updateBody({ workspaces }));

      expect(response.status).toBe(403);
      expect(checkedActions()).toEqual(["team.manage", "organization.manage"]);
      expect(mocks.can).toHaveBeenLastCalledWith(expect.anything(), "organization.manage", {
        type: "organization",
        id: ORG_ID,
      });
      expect(mocks.updateTeamDetails).not.toHaveBeenCalled();
      expect(lastAudit()).toEqual(
        expect.objectContaining({ status: "failure", organizationId: ORG_ID, targetId: TEAM_ID })
      );
    }
  );

  test("lets an owner or manager change the workspace grants", async () => {
    const workspaces = [{ workspaceId: WORKSPACE_ID, permission: "manage" }];
    expect((await update(updateBody({ workspaces }))).status).toBe(200);
    expect(checkedActions()).toEqual(["team.manage", "organization.manage"]);
    expect(mocks.updateTeamDetails).toHaveBeenCalledWith(TEAM_ID, updateBody({ workspaces }));
  });

  test("refuses a caller without team.manage with 403, and audits the refusal against the team", async () => {
    allow();
    expect((await update(updateBody())).status).toBe(403);
    expect(mocks.updateTeamDetails).not.toHaveBeenCalled();
    expect(lastAudit()).toEqual(
      expect.objectContaining({ status: "failure", organizationId: ORG_ID, targetId: TEAM_ID })
    );
  });

  test("refuses when the licence has no role management, and writes nothing", async () => {
    mocks.checkRoleManagementPermission.mockRejectedValue(
      new OperationNotAllowedError("Role management is not allowed for this organization")
    );
    expect((await update(updateBody())).status).toBe(403);
    expect(mocks.updateTeamDetails).not.toHaveBeenCalled();
  });

  test("answers 403 when the team is gone by the time it is written", async () => {
    mocks.updateTeamDetails.mockRejectedValue(new ResourceNotFoundError("Team", TEAM_ID));
    expect((await update(updateBody())).status).toBe(403);
  });

  test.each([
    ["no members", updateBody({ members: [] })],
    ["no workspaces", updateBody({ workspaces: [] })],
    ["a blank name", updateBody({ name: " " })],
    ["an unknown team role", updateBody({ members: [{ userId: USER_ID, role: "owner" }] })],
    ["an unknown field", { ...updateBody(), organizationId: OTHER_ORG_ID }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await update(body)).status).toBe(400);
    expect(mocks.updateTeamDetails).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await update(updateBody(), { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.updateTeamDetails).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/internal/teams/{teamId}", () => {
  test("deletes the team behind team.delete with a 204, and audits what was removed", async () => {
    const response = await remove();

    expect(response.status).toBe(204);
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "team.delete", {
      type: "team",
      id: TEAM_ID,
    });
    expect(checkedActions()).toEqual(["team.delete"]);
    expect(mocks.deleteTeam).toHaveBeenCalledWith(TEAM_ID);
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "deleted",
        targetType: "team",
        status: "success",
        organizationId: ORG_ID,
        targetId: TEAM_ID,
        oldObject: team(),
      })
    );
  });

  test("refuses a team admin without team.delete, deletes nothing, and audits the refusal", async () => {
    allow("team.manage");
    expect((await remove()).status).toBe(403);
    expect(mocks.deleteTeam).not.toHaveBeenCalled();
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "deleted",
        status: "failure",
        organizationId: ORG_ID,
        targetId: TEAM_ID,
      })
    );
  });

  test("refuses when the licence has no role management, and deletes nothing", async () => {
    mocks.checkRoleManagementPermission.mockRejectedValue(
      new OperationNotAllowedError("Role management is not allowed for this organization")
    );
    expect((await remove()).status).toBe(403);
    expect(mocks.deleteTeam).not.toHaveBeenCalled();
  });

  test("answers 403 for a team that does not exist, and audits the attempt against its id", async () => {
    mocks.getTeam.mockResolvedValue(null);
    expect((await remove()).status).toBe(403);
    expect(mocks.deleteTeam).not.toHaveBeenCalled();
    expect(lastAudit()).toEqual(expect.objectContaining({ status: "failure", targetId: TEAM_ID }));
  });

  test("refuses a request with neither Sec-Fetch-Site nor Origin (CSRF, fail-safe)", async () => {
    expect((await remove({ headers: {} })).status).toBe(403);
    expect(mocks.deleteTeam).not.toHaveBeenCalled();
  });
});
