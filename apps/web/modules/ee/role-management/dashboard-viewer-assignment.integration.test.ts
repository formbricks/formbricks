import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";
import { updateTeamDetails } from "@/modules/ee/teams/team-list/lib/team";
import { createApiKeyAction } from "@/modules/organization/settings/api-keys/actions";
import { bulkInviteUsersAction, inviteUserAction } from "@/modules/organization/settings/teams/actions";
import { updateInviteAction, updateMembershipAction } from "./actions";

/**
 * Who may make someone a Dashboard viewer (ENG-6901, ADR-0023), through the real server actions against
 * real PostgreSQL and SpiceDB: Owners and Managers, in single invites, CSV bulk invites, invite edits and
 * role edits, only while Access Control and Dashboards are both entitled. A team admin can't, and a viewer
 * can't be a team admin.
 */

const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/modules/auth/lib/session", () => ({
  getSession: vi.fn(async () =>
    session.userId ? { user: { id: session.userId }, expires: "2099-01-01T00:00:00.000Z" } : null
  ),
}));

// Request metadata reads `headers()`, which only exists inside a Next request.
vi.mock("@/modules/ee/audit-logs/lib/request-metadata", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ee/audit-logs/lib/request-metadata")>();
  return { ...actual, getAuditRequestMetadata: vi.fn(async () => actual.UNKNOWN_AUDIT_REQUEST_METADATA) };
});

const entitlement = vi.hoisted(() => ({ accessControl: true, viewerRole: true }));
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getAccessControlPermission: vi.fn(async () => entitlement.accessControl),
  getIsDashboardViewerRoleEnabled: vi.fn(async () => entitlement.viewerRole && entitlement.accessControl),
  getBulkInvitePermission: vi.fn(async () => true),
}));

const ids = { organization: "", owner: "", manager: "", teamAdmin: "", target: "", team: "", workspace: "" };
let emailCounter = 0;
const nextEmail = () => `invitee-${++emailCounter}@assign.test`;

const as = (userId: string) => {
  session.userId = userId;
};

const invite = (role: string, teamIds: string[] = []) =>
  inviteUserAction({
    organizationId: ids.organization,
    email: nextEmail(),
    name: "Invitee",
    role,
    teamIds,
  } as never);

const setRole = (userId: string, role: string) =>
  updateMembershipAction({ organizationId: ids.organization, userId, data: { role } } as never);

beforeAll(async () => {
  await resetDb();
  const organization = await prisma.organization.create({ data: { name: "Assign Org" } });
  ids.organization = organization.id;
  const workspace = await prisma.workspace.create({ data: { name: "W", organizationId: organization.id } });
  ids.workspace = workspace.id;

  const user = async (label: string, role: "owner" | "manager" | "member") => {
    const created = await prisma.user.create({ data: { email: `${label}@assign.test`, name: label } });
    await prisma.membership.create({
      data: { accepted: true, organizationId: organization.id, role, userId: created.id },
    });
    return created.id;
  };
  ids.owner = await user("owner", "owner");
  ids.manager = await user("manager", "manager");
  ids.teamAdmin = await user("team-admin", "member");
  ids.target = await user("target", "member");

  const team = await prisma.team.create({ data: { name: "Field", organizationId: organization.id } });
  ids.team = team.id;
  await prisma.teamUser.createMany({
    data: [
      { teamId: team.id, userId: ids.teamAdmin, role: "admin" },
      { teamId: team.id, userId: ids.target, role: "admin" },
    ],
  });
  await prisma.workspaceTeam.create({
    data: { teamId: team.id, workspaceId: workspace.id, permission: "read" },
  });

  await synchronizeAuthzedIntegrationFixture();
}, 120_000);

beforeEach(() => {
  entitlement.accessControl = true;
  entitlement.viewerRole = true;
});

describe("single invites", () => {
  test.each([
    ["an Owner", () => ids.owner],
    ["a Manager", () => ids.manager],
  ])("%s invites a Dashboard viewer", async (_label, inviter) => {
    as(inviter());
    const result = await invite("dashboard_viewer", [ids.team]);

    expect(result?.serverError).toBeUndefined();
    const created = await prisma.invite.findUniqueOrThrow({ where: { id: result?.data as string } });
    expect(created.role).toBe("dashboard_viewer");
  });

  test("a Manager still can't invite a Manager", async () => {
    as(ids.manager);
    expect((await invite("manager"))?.serverError).toBe(
      "Managers can only give the Member and Dashboard viewer roles"
    );
  });

  test("a team admin can't invite a Dashboard viewer", async () => {
    as(ids.teamAdmin);
    expect((await invite("dashboard_viewer", [ids.team]))?.serverError).toBe(
      "Team admins can only invite users as members"
    );
  });

  test.each([
    ["Access Control", { accessControl: false, viewerRole: true }],
    ["Dashboards", { accessControl: true, viewerRole: false }],
  ])("without %s nobody invites a Dashboard viewer", async (_label, state) => {
    Object.assign(entitlement, state);
    as(ids.owner);

    expect((await invite("dashboard_viewer"))?.serverError).toBeDefined();
    expect(
      await prisma.invite.count({
        where: { role: "dashboard_viewer", email: `invitee-${emailCounter}@assign.test` },
      })
    ).toBe(0);
  });

  test("without the entitlement a Member invite still works", async () => {
    entitlement.viewerRole = false;
    as(ids.owner);
    expect((await invite("member"))?.serverError).toBeUndefined();
  });
});

describe("CSV bulk invites", () => {
  test("200 Dashboard viewer rows are all invited", async () => {
    as(ids.owner);
    const invitees = Array.from({ length: 200 }, (_unused, index) => ({
      name: `Viewer ${index}`,
      email: `bulk-${index}@assign.test`,
      role: "dashboard_viewer",
      teamIds: [ids.team],
    }));

    const result = await bulkInviteUsersAction({ organizationId: ids.organization, invitees } as never);

    expect(result?.serverError).toBeUndefined();
    expect(result?.data?.every(({ success }) => success)).toBe(true);
    expect(
      await prisma.invite.count({ where: { role: "dashboard_viewer", email: { startsWith: "bulk-" } } })
    ).toBe(200);
  }, 60_000);

  test("a Manager may bulk invite viewers, and the whole batch is refused without the entitlement", async () => {
    as(ids.manager);
    const row = (email: string, role: string) => ({ name: "R", email, role, teamIds: [] });

    const allowed = await bulkInviteUsersAction({
      organizationId: ids.organization,
      invitees: [row("mgr-bulk-1@assign.test", "dashboard_viewer"), row("mgr-bulk-2@assign.test", "member")],
    } as never);
    expect(allowed?.serverError).toBeUndefined();

    entitlement.viewerRole = false;
    const refused = await bulkInviteUsersAction({
      organizationId: ids.organization,
      invitees: [row("mgr-bulk-3@assign.test", "member"), row("mgr-bulk-4@assign.test", "dashboard_viewer")],
    } as never);
    expect(refused?.serverError).toBeDefined();
    expect(
      await prisma.invite.count({
        where: { email: { in: ["mgr-bulk-3@assign.test", "mgr-bulk-4@assign.test"] } },
      })
    ).toBe(0);
  });
});

describe("role edits", () => {
  test("a Manager turns a pending invite into a Dashboard viewer invite", async () => {
    as(ids.owner);
    const pending = await invite("member");
    as(ids.manager);

    const result = await updateInviteAction({
      inviteId: pending?.data as string,
      data: { role: "dashboard_viewer" },
    } as never);

    expect(result?.serverError).toBeUndefined();
    expect((await prisma.invite.findUniqueOrThrow({ where: { id: pending?.data as string } })).role).toBe(
      "dashboard_viewer"
    );
  });

  test("without the entitlement an invite can't be turned into a viewer invite", async () => {
    as(ids.owner);
    const pending = await invite("member");
    entitlement.viewerRole = false;

    const result = await updateInviteAction({
      inviteId: pending?.data as string,
      data: { role: "dashboard_viewer" },
    } as never);
    expect(result?.serverError).toBeDefined();
  });

  test("without the entitlement a Member can't be made a viewer", async () => {
    entitlement.viewerRole = false;
    as(ids.owner);
    expect((await setRole(ids.target, "dashboard_viewer"))?.serverError).toBeDefined();
    const membership = await prisma.membership.findUniqueOrThrow({
      where: { userId_organizationId: { userId: ids.target, organizationId: ids.organization } },
    });
    expect(membership.role).toBe("member");
  });

  // A Manager's own role edits depend on USER_MANAGEMENT_MINIMUM_ROLE, so this one runs as the Owner; the
  // Manager's right to give the role is the invite-edit case above and `canManagerAssignRole`.
  test("making a team admin a Dashboard viewer demotes them to contributor", async () => {
    as(ids.owner);
    expect((await setRole(ids.target, "dashboard_viewer"))?.serverError).toBeUndefined();

    const teamUser = await prisma.teamUser.findUniqueOrThrow({
      where: { teamId_userId: { teamId: ids.team, userId: ids.target } },
    });
    expect(teamUser.role).toBe("contributor");
  });

  test("a Dashboard viewer can't be made a team admin", async () => {
    await expect(
      updateTeamDetails(ids.team, {
        name: "Field",
        members: [
          { userId: ids.teamAdmin, role: "admin" },
          { userId: ids.target, role: "admin" },
        ],
        workspaces: [{ workspaceId: ids.workspace, permission: "read" }],
      })
    ).rejects.toThrow("A Dashboard viewer can't be a team admin");
  });

  test("a Dashboard viewer can't create an API key (regression, ENG-6903)", async () => {
    as(ids.target);
    const result = await createApiKeyAction({
      organizationId: ids.organization,
      apiKeyData: {
        label: "viewer key",
        workspaceAccess: [{ workspaceId: ids.workspace, permission: "read" }],
        organizationAccess: { accessControl: { read: false, write: false } },
      },
    } as never);

    expect(result?.serverError).toBeDefined();
    expect(await prisma.apiKey.count({ where: { organizationId: ids.organization } })).toBe(0);
  });

  test("an Owner changes the viewer back to Member", async () => {
    as(ids.owner);
    expect((await setRole(ids.target, "member"))?.serverError).toBeUndefined();
  });
});
