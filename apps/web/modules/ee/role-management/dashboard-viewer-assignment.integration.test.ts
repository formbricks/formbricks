import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { POST as createApiKeyRoute } from "@/app/api/internal/api-keys/route";
import { PATCH as updateInviteRoute } from "@/app/api/internal/invites/[inviteId]/route";
import { POST as createInviteBatchRoute } from "@/app/api/internal/invites/batches/route";
import { POST as createInviteRoute } from "@/app/api/internal/invites/route";
import { PATCH as updateMemberRoute } from "@/app/api/internal/members/[userId]/route";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";
import { updateTeamDetails } from "@/modules/ee/teams/team-list/lib/team";

/**
 * Who may make someone a Dashboard viewer (ENG-6901, ADR-0025), through the real internal routes against
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

/** A session write to an internal route, as the dashboard sends it (same-origin, JSON). */
const send = (
  handler: (req: NextRequest, context: never) => Promise<Response>,
  url: string,
  method: "PATCH" | "POST",
  body: unknown,
  params: Record<string, string> = {}
) =>
  handler(
    new NextRequest(`http://localhost${url}`, {
      method,
      headers: { ...SAME_ORIGIN_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve(params) } as never
  );

/** A single invite, as the invite form sends it: the created invite's id, or the refusal's status and reason. */
const invite = async (role: string, teamIds: string[] = []) => {
  const response = await send(
    createInviteRoute,
    `/api/internal/invites?organizationId=${ids.organization}`,
    "POST",
    { email: nextEmail(), name: "Invitee", role, teamIds }
  );
  const body = await response.json();
  return { status: response.status, id: body.data?.id as string | undefined, detail: body.detail as string };
};

const bulkInvite = (invitees: unknown[]) =>
  send(createInviteBatchRoute, `/api/internal/invites/batches?organizationId=${ids.organization}`, "POST", {
    invitees,
  });

const setRole = (userId: string, role: string) =>
  send(
    updateMemberRoute,
    `/api/internal/members/${userId}?organizationId=${ids.organization}`,
    "PATCH",
    { role },
    { userId }
  );

const setInviteRole = (inviteId: string, role: string) =>
  send(updateInviteRoute, `/api/internal/invites/${inviteId}`, "PATCH", { role }, { inviteId });

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

    expect(result.status).toBe(201);
    const created = await prisma.invite.findUniqueOrThrow({ where: { id: result.id } });
    expect(created.role).toBe("dashboard_viewer");
  });

  test("a Manager still can't invite a Manager", async () => {
    as(ids.manager);
    expect((await invite("manager")).detail).toBe(
      "Managers can only give the Member and Dashboard viewer roles"
    );
  });

  test("a team admin can't invite a Dashboard viewer", async () => {
    as(ids.teamAdmin);
    expect((await invite("dashboard_viewer", [ids.team])).detail).toBe(
      "Team admins can only invite users as members"
    );
  });

  test.each([
    ["Access Control", { accessControl: false, viewerRole: true }],
    ["Dashboards", { accessControl: true, viewerRole: false }],
  ])("without %s nobody invites a Dashboard viewer", async (_label, state) => {
    Object.assign(entitlement, state);
    as(ids.owner);

    expect((await invite("dashboard_viewer")).status).toBe(403);
    expect(
      await prisma.invite.count({
        where: { role: "dashboard_viewer", email: `invitee-${emailCounter}@assign.test` },
      })
    ).toBe(0);
  });

  test("without the entitlement a Member invite still works", async () => {
    entitlement.viewerRole = false;
    as(ids.owner);
    expect((await invite("member")).status).toBe(201);
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

    const response = await bulkInvite(invitees);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: { success: boolean }[] };
    expect(data.every(({ success }) => success)).toBe(true);
    expect(
      await prisma.invite.count({ where: { role: "dashboard_viewer", email: { startsWith: "bulk-" } } })
    ).toBe(200);
  }, 60_000);

  test("a Manager may bulk invite viewers, and the whole batch is refused without the entitlement", async () => {
    as(ids.manager);
    const row = (email: string, role: string) => ({ name: "R", email, role, teamIds: [] });

    const allowed = await bulkInvite([
      row("mgr-bulk-1@assign.test", "dashboard_viewer"),
      row("mgr-bulk-2@assign.test", "member"),
    ]);
    expect(allowed.status).toBe(200);

    entitlement.viewerRole = false;
    const refused = await bulkInvite([
      row("mgr-bulk-3@assign.test", "member"),
      row("mgr-bulk-4@assign.test", "dashboard_viewer"),
    ]);
    expect(refused.status).toBe(403);
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

    const response = await setInviteRole(pending.id as string, "dashboard_viewer");

    expect(response.status).toBe(200);
    expect((await prisma.invite.findUniqueOrThrow({ where: { id: pending.id as string } })).role).toBe(
      "dashboard_viewer"
    );
  });

  test("without the entitlement an invite can't be turned into a viewer invite", async () => {
    as(ids.owner);
    const pending = await invite("member");
    entitlement.viewerRole = false;

    expect((await setInviteRole(pending.id as string, "dashboard_viewer")).status).toBe(403);
  });

  test("without the entitlement a Member can't be made a viewer", async () => {
    entitlement.viewerRole = false;
    as(ids.owner);
    expect((await setRole(ids.target, "dashboard_viewer")).status).toBe(403);
    const membership = await prisma.membership.findUniqueOrThrow({
      where: { userId_organizationId: { userId: ids.target, organizationId: ids.organization } },
    });
    expect(membership.role).toBe("member");
  });

  // A Manager's own role edits depend on USER_MANAGEMENT_MINIMUM_ROLE, so this one runs as the Owner; the
  // Manager's right to give the role is the invite-edit case above and `canManagerAssignRole`.
  test("making a team admin a Dashboard viewer demotes them to contributor", async () => {
    as(ids.owner);
    expect((await setRole(ids.target, "dashboard_viewer")).status).toBe(200);

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
    const response = await send(
      createApiKeyRoute,
      `/api/internal/api-keys?organizationId=${ids.organization}`,
      "POST",
      {
        label: "viewer key",
        workspacePermissions: [{ workspaceId: ids.workspace, permission: "read" }],
        organizationAccess: { accessControl: { read: false, write: false } },
      }
    );

    expect(response.status).toBe(403);
    expect(await prisma.apiKey.count({ where: { organizationId: ids.organization } })).toBe(0);
  });

  test("an Owner changes the viewer back to Member", async () => {
    as(ids.owner);
    expect((await setRole(ids.target, "member")).status).toBe(200);
  });
});
