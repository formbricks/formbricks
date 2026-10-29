import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { can } from "@/lib/authorization";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import {
  createTeam,
  deleteTeam,
  getTeamDetails,
  updateTeamDetails,
} from "@/modules/ee/teams/team-list/lib/team";
import { getTeamDirectory } from "@/modules/shell/organization/lib/team-directory";
import {
  countOrganizationTeams,
  countOrganizationWorkspaces,
  getOrganizationRoles,
  isTeamNameTaken,
} from "./data";
import { createV3Team, deleteV3Team, getV3Team, listV3Teams, updateV3Team } from "./operations";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));
vi.mock("@/app/api/v3/lib/audit", () => ({ skipV3AuditLog: vi.fn() }));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/membership/service", () => ({ getMembershipByUserIdOrganizationId: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getAccessControlPermission: vi.fn() }));
vi.mock("@/modules/ee/teams/team-list/lib/team", () => ({
  createTeam: vi.fn(),
  deleteTeam: vi.fn(),
  getTeamDetails: vi.fn(),
  updateTeamDetails: vi.fn(),
}));
vi.mock("@/modules/shell/organization/lib/team-directory", () => ({ getTeamDirectory: vi.fn() }));
vi.mock("./data", () => ({
  countOrganizationTeams: vi.fn(),
  countOrganizationWorkspaces: vi.fn(),
  getOrganizationRoles: vi.fn(),
  isTeamNameTaken: vi.fn(),
}));

const organizationId = "tz4a98xxat96iws9zmbrgj3a";
const teamId = "clteam1111111111111111111";
const requestId = "req_1";
const instance = "/api/mcp";
const user = (id: string) => ({ user: { id, name: "Person" }, expires: "2099-01-01" }) as never;
const owner = user("usrowner00000000000000000");
const teamAdmin = user("usradmin0000000000000000");
const apiKey = { apiKeyId: "key_1", organizationId, workspacePermissions: [] } as never;

const base = { requestId, instance };
const team = (overrides: Record<string, unknown> = {}) => ({
  id: teamId,
  name: "Support",
  organizationId,
  members: [
    { userId: "usradmin0000000000000000", name: "Ada", role: "admin" },
    { userId: "usrb000000000000000000000", name: "Bo", role: "contributor" },
  ],
  workspaces: [{ workspaceId: "ws1000000000000000000000", workspaceName: "Web", permission: "read" }],
  ...overrides,
});

/** Grants the listed actions; every other `can` question answers no. */
const grant = (...actions: string[]) =>
  vi
    .mocked(can)
    .mockImplementation((async (_actor: unknown, action: string) => actions.includes(action)) as never);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getAccessControlPermission).mockResolvedValue(true);
  vi.mocked(getTeamDetails).mockResolvedValue(team() as never);
  vi.mocked(getOrganizationRoles).mockResolvedValue(
    new Map([
      ["usradmin0000000000000000", "member"],
      ["usrb000000000000000000000", "member"],
      ["usrc000000000000000000000", "member"],
      ["usrmanager0000000000000000", "manager"],
    ]) as never
  );
  vi.mocked(countOrganizationWorkspaces).mockImplementation(async (_org, ids) => ids.length);
  vi.mocked(isTeamNameTaken).mockResolvedValue(false);
});

describe("listV3Teams", () => {
  const call = (authentication: unknown = owner) =>
    listV3Teams({ organizationId, authentication: authentication as never, ...base });

  test("answers the documented licence 403, never an empty list, without the teams licence", async () => {
    grant("organization.read_access", "organization.manage");
    vi.mocked(getAccessControlPermission).mockResolvedValue(false);

    const response = await call();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toMatch(/Enterprise licence/);
    expect(getTeamDirectory).not.toHaveBeenCalled();
  });

  test("a caller outside the organization (or the billing role) gets the hidden 403, before the licence is consulted", async () => {
    grant();

    const response = await call();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(getAccessControlPermission).not.toHaveBeenCalled();
  });

  test("an API key is refused", async () => {
    expect((await call(apiKey)).status).toBe(403);
    expect(can).not.toHaveBeenCalled();
  });

  test("an owner or manager sees workspace access; the list carries the total", async () => {
    grant("organization.read_access", "organization.manage");
    vi.mocked(countOrganizationTeams).mockResolvedValue(1);
    vi.mocked(getTeamDirectory).mockResolvedValue([
      {
        id: teamId,
        name: "Support",
        memberCount: 2,
        viewerRole: null,
        access: [{ workspaceId: "ws1000000000000000000000", workspaceName: "Web", permission: "read" }],
      },
    ]);

    const response = await call();
    const body = await response.json();

    expect(getTeamDirectory).toHaveBeenCalledWith(organizationId, "usrowner00000000000000000", true);
    expect(body.data).toEqual([
      {
        id: teamId,
        name: "Support",
        memberCount: 2,
        viewerRole: null,
        workspaces: [{ workspaceId: "ws1000000000000000000000", workspaceName: "Web", permission: "read" }],
      },
    ]);
    expect(body.meta).toMatchObject({
      limit: 200,
      nextCursor: null,
      totalCount: 1,
      totalCountRelation: "eq",
    });
  });

  test("an ordinary member gets no workspace access", async () => {
    grant("organization.read_access");
    vi.mocked(countOrganizationTeams).mockResolvedValue(1);
    vi.mocked(getTeamDirectory).mockResolvedValue([
      { id: teamId, name: "Support", memberCount: 2, viewerRole: "contributor", access: null },
    ]);

    const body = await (await call(teamAdmin)).json();

    expect(getTeamDirectory).toHaveBeenCalledWith(organizationId, "usradmin0000000000000000", false);
    expect(body.data[0].workspaces).toBeNull();
  });
});

describe("getV3Team", () => {
  const call = (authentication: unknown = teamAdmin) =>
    getV3Team({ teamId, authentication: authentication as never, ...base });

  test("a team admin reads the team with members and workspace access", async () => {
    grant("team.manage");

    const response = await call();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(team());
    expect(can).toHaveBeenCalledWith({ type: "user", id: "usradmin0000000000000000" }, "team.manage", {
      type: "team",
      id: teamId,
    });
  });

  test("someone who cannot manage the team gets the hidden 403", async () => {
    grant();

    expect((await call()).status).toBe(403);
    expect(getTeamDetails).not.toHaveBeenCalled();
  });

  test("a team that vanished answers the same hidden 403", async () => {
    grant("team.manage");
    vi.mocked(getTeamDetails).mockResolvedValue(null);

    const response = await call();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
  });

  test("without the licence it answers the licence 403", async () => {
    grant("team.manage");
    vi.mocked(getAccessControlPermission).mockResolvedValue(false);

    const response = await call();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toMatch(/Enterprise licence/);
  });
});

describe("createV3Team", () => {
  const call = (body: unknown, authentication: unknown = owner, auditLog?: Record<string, unknown>) =>
    createV3Team({
      organizationId,
      body,
      authentication: authentication as never,
      auditLog: auditLog as never,
      ...base,
    });

  beforeEach(() => {
    grant("organization.manage");
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "owner" } as never);
    vi.mocked(createTeam).mockResolvedValue(teamId);
    vi.mocked(getTeamDetails).mockResolvedValue(team({ members: [], workspaces: [] }) as never);
  });

  test("creates an empty team, audited, with a Location", async () => {
    const auditLog: Record<string, unknown> = {};

    const response = await call({ name: " Support " }, owner, auditLog);

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/v3/teams/${teamId}`);
    expect(createTeam).toHaveBeenCalledWith(organizationId, "Support");
    expect(auditLog).toMatchObject({ organizationId, targetId: teamId });
    expect(applyRateLimit).toHaveBeenCalledOnce();
  });

  test("a team admin who is not an owner or manager is refused", async () => {
    grant();

    expect((await call({ name: "Support" }, teamAdmin)).status).toBe(403);
    expect(createTeam).not.toHaveBeenCalled();
  });

  test("without the licence nothing is created", async () => {
    vi.mocked(getAccessControlPermission).mockResolvedValue(false);

    const response = await call({ name: "Support" });

    expect(response.status).toBe(403);
    expect(createTeam).not.toHaveBeenCalled();
  });

  test("a duplicate name is a 409 and an unknown key a 400", async () => {
    vi.mocked(createTeam).mockRejectedValue(new InvalidInputError("Team name already exists"));

    expect((await call({ name: "Support" })).status).toBe(409);
    expect((await call({ name: "Support", organizationId })).status).toBe(400);
  });
});

describe("updateV3Team", () => {
  const call = (body: unknown, authentication: unknown = owner, auditLog?: Record<string, unknown>) =>
    updateV3Team({
      teamId,
      body,
      authentication: authentication as never,
      auditLog: auditLog as never,
      ...base,
    });

  beforeEach(() => {
    grant("team.manage", "organization.manage");
    vi.mocked(updateTeamDetails).mockResolvedValue(true);
  });

  test("adding a member applies at once, audited with the old and new team, and keeps the other lists", async () => {
    const auditLog: Record<string, unknown> = {};
    vi.mocked(getTeamDetails)
      .mockResolvedValueOnce(team() as never)
      .mockResolvedValueOnce(
        team({
          members: [
            ...team().members,
            { userId: "usrc000000000000000000000", name: "Cy", role: "contributor" },
          ],
        }) as never
      );

    const response = await call(
      {
        members: [
          { userId: "usradmin0000000000000000", role: "admin" },
          { userId: "usrb000000000000000000000" },
          { userId: "usrc000000000000000000000" },
        ],
      },
      owner,
      auditLog
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("updated");
    expect(body.data.changes.membersAdded).toEqual(["usrc000000000000000000000"]);
    expect(updateTeamDetails).toHaveBeenCalledWith(teamId, {
      name: "Support",
      members: [
        { userId: "usradmin0000000000000000", role: "admin" },
        { userId: "usrb000000000000000000000", role: "contributor" },
        { userId: "usrc000000000000000000000", role: "contributor" },
      ],
      workspaces: [{ workspaceId: "ws1000000000000000000000", permission: "read" }],
    });
    expect(auditLog).toMatchObject({ organizationId, targetId: teamId, oldObject: team() });
    expect(applyRateLimit).toHaveBeenCalledOnce();
  });

  test.each([
    ["removing a member", { members: [{ userId: "usradmin0000000000000000" }] }],
    ["removing all workspace access", { workspaces: [] }],
  ])("%s is previewed unless confirm is true, and writes and audits nothing", async (_label, body) => {
    const auditLog = {};

    const response = await call(body, owner, auditLog);
    const data = (await response.json()).data;

    expect(response.status).toBe(200);
    expect(data.status).toBe("preview");
    expect(data.team).toEqual(team());
    expect(updateTeamDetails).not.toHaveBeenCalled();
    expect(skipV3AuditLog).toHaveBeenCalledWith(auditLog);
    expect(applyRateLimit).not.toHaveBeenCalled();
  });

  test("the same removal with confirm: true is written", async () => {
    const response = await call({ members: [{ userId: "usradmin0000000000000000" }], confirm: true });

    expect((await response.json()).data.status).toBe("updated");
    expect(updateTeamDetails).toHaveBeenCalledOnce();
  });

  test("a request that matches the stored team is unchanged and not audited", async () => {
    const auditLog = {};

    const response = await call({ name: "Support" }, owner, auditLog);

    expect((await response.json()).data.status).toBe("unchanged");
    expect(updateTeamDetails).not.toHaveBeenCalled();
    expect(skipV3AuditLog).toHaveBeenCalledWith(auditLog);
  });

  test("an empty change is a 400", async () => {
    expect((await call({})).status).toBe(400);
    expect((await call({ confirm: true })).status).toBe(400);
  });

  test("a repeated member is a 400", async () => {
    expect(
      (
        await call({
          members: [{ userId: "usrb000000000000000000000" }, { userId: "usrb000000000000000000000" }],
        })
      ).status
    ).toBe(400);
  });

  test("someone who cannot manage the team gets the hidden 403", async () => {
    grant();

    expect((await call({ name: "Other" })).status).toBe(403);
    expect(updateTeamDetails).not.toHaveBeenCalled();
  });

  test("without the licence it answers the licence 403 and writes nothing", async () => {
    vi.mocked(getAccessControlPermission).mockResolvedValue(false);

    const response = await call({ name: "Other" });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toMatch(/Enterprise licence/);
    expect(updateTeamDetails).not.toHaveBeenCalled();
  });

  test("a rename to a name another team has is a 409", async () => {
    vi.mocked(isTeamNameTaken).mockResolvedValue(true);

    expect((await call({ name: "Sales" })).status).toBe(409);
    expect(isTeamNameTaken).toHaveBeenCalledWith(organizationId, "Sales", teamId);
  });

  test("a person from outside the organization, or another organization's workspace, is a 422", async () => {
    expect((await call({ members: [{ userId: "usrstranger00000000000000" }] })).status).toBe(422);

    vi.mocked(countOrganizationWorkspaces).mockResolvedValue(0);
    expect(
      (await call({ workspaces: [{ workspaceId: "wsother00000000000000000", permission: "read" }] })).status
    ).toBe(422);
    expect(updateTeamDetails).not.toHaveBeenCalled();
  });

  test("an organization owner or manager cannot be made a contributor, and defaults to admin", async () => {
    expect(
      (await call({ members: [{ userId: "usrmanager0000000000000000", role: "contributor" }] })).status
    ).toBe(422);

    await call({
      members: [
        { userId: "usrmanager0000000000000000" },
        { userId: "usradmin0000000000000000" },
        { userId: "usrb000000000000000000000" },
      ],
      confirm: true,
    });
    expect(vi.mocked(updateTeamDetails).mock.calls[0][1].members).toContainEqual({
      userId: "usrmanager0000000000000000",
      role: "admin",
    });
  });

  describe("as a team admin who is not an owner or manager", () => {
    beforeEach(() => grant("team.manage"));

    test("may edit the members, but the workspace access is for owners and managers", async () => {
      const members = await call(
        {
          members: [
            { userId: "usradmin0000000000000000" },
            { userId: "usrb000000000000000000000" },
            { userId: "usrc000000000000000000000" },
          ],
        },
        teamAdmin
      );
      expect(members.status).toBe(200);

      const workspaces = await call(
        { workspaces: [{ workspaceId: "ws1000000000000000000000", permission: "manage" }] },
        teamAdmin
      );
      expect(workspaces.status).toBe(403);
      expect((await workspaces.json()).detail).toMatch(/owners and managers/);
    });

    test("sending the stored workspace access unchanged is not a change to it", async () => {
      const response = await call(
        { workspaces: [{ workspaceId: "ws1000000000000000000000", permission: "read" }], name: "Help" },
        teamAdmin
      );

      expect(response.status).toBe(200);
    });

    test("cannot remove themselves or change their own team role", async () => {
      const removed = await call(
        { members: [{ userId: "usrb000000000000000000000" }], confirm: true },
        teamAdmin
      );
      expect(removed.status).toBe(403);

      const demoted = await call(
        {
          members: [
            { userId: "usradmin0000000000000000", role: "contributor" },
            { userId: "usrb000000000000000000000" },
          ],
          confirm: true,
        },
        teamAdmin
      );
      expect(demoted.status).toBe(403);
      expect(updateTeamDetails).not.toHaveBeenCalled();
    });
  });

  test("an API key is refused", async () => {
    expect((await call({ name: "Other" }, apiKey)).status).toBe(403);
  });
});

describe("deleteV3Team", () => {
  const call = (confirm?: boolean, authentication: unknown = owner, auditLog?: Record<string, unknown>) =>
    deleteV3Team({
      teamId,
      confirm,
      authentication: authentication as never,
      auditLog: auditLog as never,
      ...base,
    });

  beforeEach(() => grant("team.delete"));

  test("without confirm it previews with the counts and deletes and audits nothing", async () => {
    const auditLog = {};

    const response = await call(undefined, owner, auditLog);
    const data = (await response.json()).data;

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ status: "preview", id: teamId, memberCount: 2, workspaceCount: 1 });
    expect(deleteTeam).not.toHaveBeenCalled();
    expect(skipV3AuditLog).toHaveBeenCalledWith(auditLog);
  });

  test("confirm false is still a preview", async () => {
    expect((await (await call(false)).json()).data.status).toBe("preview");
    expect(deleteTeam).not.toHaveBeenCalled();
  });

  test("with confirm: true it deletes, audited with the old team", async () => {
    const auditLog: Record<string, unknown> = {};

    const response = await call(true, owner, auditLog);

    expect((await response.json()).data.status).toBe("deleted");
    expect(deleteTeam).toHaveBeenCalledWith(teamId);
    expect(auditLog).toMatchObject({ organizationId, targetId: teamId, oldObject: team() });
    expect(can).toHaveBeenCalledWith({ type: "user", id: "usrowner00000000000000000" }, "team.delete", {
      type: "team",
      id: teamId,
    });
  });

  test("a team admin without team.delete, and a missing team, get the hidden 403", async () => {
    grant("team.manage");
    expect((await call(true, teamAdmin)).status).toBe(403);

    grant("team.delete");
    vi.mocked(getTeamDetails).mockResolvedValue(null);
    expect((await call(true)).status).toBe(403);
    expect(deleteTeam).not.toHaveBeenCalled();
  });

  test("without the licence nothing is deleted, preview or not", async () => {
    vi.mocked(getAccessControlPermission).mockResolvedValue(false);

    expect((await call(true)).status).toBe(403);
    expect((await call()).status).toBe(403);
    expect(deleteTeam).not.toHaveBeenCalled();
  });
});
