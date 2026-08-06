import { beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { resetDb } from "@/integration/reset-db";
import { type TAccess, checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";

/**
 * ENG-1737: proof that deleting the action-client's legacy evaluator changed no live decision.
 *
 * Removing it was justified by an inventory (all 125 call sites use one of five organization role
 * sets, none uses the `team` shape) plus the argument that the central path is a superset of the
 * legacy one for every shape that remains. The inventory was a regex over the repository and the
 * superset claim was reasoning — neither is a measurement, and reasoning about which evaluator
 * enforces what is precisely what went wrong once already in this change.
 *
 * So: every access shape the repository actually produces, crossed with every organization role and
 * workspace-grant combination, decided twice against real rows in Postgres — once by
 * `checkAuthorizationUpdated` as it now stands (central only), and once by the deleted
 * `checkLegacyAuthorization`, replayed below from
 * `git show origin/epic/authzed:apps/web/lib/utils/action-client/action-client-middleware.ts`.
 *
 * The old function was `central OR legacy`. If central and legacy agree on every cell, that union
 * was a no-op and removing it moved nothing.
 */
const TEAM_PERMISSION_WEIGHT = { read: 1, readWrite: 2, manage: 3 } as const;

const replayDeletedLegacyPath = async (
  userId: string,
  organizationId: string,
  access: TAccess<never>[]
): Promise<boolean> => {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  });
  const role = membership?.role;

  for (const accessItem of access) {
    if (accessItem.type === "organization" && role && accessItem.roles.includes(role)) return true;

    if (accessItem.type === "workspaceTeam") {
      // getWorkspacePermissionByUserId: highest WorkspaceTeam permission across the user's teams.
      const grants = await prisma.workspaceTeam.findMany({
        where: { workspaceId: accessItem.workspaceId, team: { teamUsers: { some: { userId } } } },
        select: { permission: true },
      });
      if (grants.length > 0) {
        const highest = grants.reduce(
          (max, grant) =>
            TEAM_PERMISSION_WEIGHT[grant.permission] > TEAM_PERMISSION_WEIGHT[max] ? grant.permission : max,
          grants[0].permission
        );
        const required = accessItem.minPermission;
        if (!required || TEAM_PERMISSION_WEIGHT[highest] >= TEAM_PERMISSION_WEIGHT[required]) return true;
      }
    }
  }

  return false;
};

const decidesAllow = async (
  userId: string,
  organizationId: string,
  access: TAccess<never>[]
): Promise<boolean> => {
  try {
    return (await checkAuthorizationUpdated({ userId, organizationId, access })) === true;
  } catch {
    return false;
  }
};

/** The eight shapes the repository produces, by organization role set and workspace grant level. */
const buildShapes = (workspaceId: string): { access: TAccess<never>[]; name: string }[] => [
  { name: "org(manager,owner)", access: [{ type: "organization", roles: ["owner", "manager"] }] },
  {
    name: "org(billing,manager,owner)",
    access: [{ type: "organization", roles: ["owner", "manager", "billing"] }],
  },
  {
    name: "org(manager,member,owner)",
    access: [{ type: "organization", roles: ["owner", "manager", "member"] }],
  },
  {
    name: "org(billing,manager,member,owner)",
    access: [{ type: "organization", roles: ["owner", "manager", "member", "billing"] }],
  },
  ...(["read", "readWrite", "manage"] as const).map((minPermission) => ({
    name: `org(manager,owner) + ws(${minPermission})`,
    access: [
      { type: "organization" as const, roles: ["owner", "manager"] as TOrganizationRole[] },
      { type: "workspaceTeam" as const, workspaceId, minPermission },
    ],
  })),
  {
    name: "org(manager,owner) + ws(DEFAULT)",
    access: [
      { type: "organization", roles: ["owner", "manager"] },
      { type: "workspaceTeam", workspaceId },
    ],
  },
];

const scenario: {
  organizationId: string;
  users: { name: string; userId: string }[];
  workspaceId: string;
} = { organizationId: "", users: [], workspaceId: "" };

beforeAll(async () => {
  await resetDb();

  const organization = await prisma.organization.create({ data: { name: "Action Client Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Action Client Workspace", organizationId: organization.id },
  });

  const makeGrantedTeam = async (name: string, permission: "read" | "readWrite" | "manage") => {
    const team = await prisma.team.create({ data: { name, organizationId: organization.id } });
    await prisma.workspaceTeam.create({ data: { teamId: team.id, workspaceId: workspace.id, permission } });
    return team.id;
  };

  const readTeam = await makeGrantedTeam("Readers", "read");
  const manageTeam = await makeGrantedTeam("Managers", "manage");

  const makeUser = async (label: string, role: TOrganizationRole | null, teamId?: string) => {
    const user = await prisma.user.create({ data: { name: label, email: `${label}@ac.test` } });
    if (role) {
      await prisma.membership.create({
        data: { userId: user.id, organizationId: organization.id, role, accepted: true },
      });
    }
    if (teamId) {
      await prisma.teamUser.create({ data: { teamId, userId: user.id, role: "contributor" } });
    }
    scenario.users.push({ name: label, userId: user.id });
  };

  await makeUser("owner", "owner");
  await makeUser("manager", "manager");
  await makeUser("billing", "billing");
  await makeUser("member-read-grant", "member", readTeam);
  await makeUser("member-manage-grant", "member", manageTeam);
  await makeUser("member-no-grant", "member");
  await makeUser("non-member", null);

  scenario.organizationId = organization.id;
  scenario.workspaceId = workspace.id;
}, 120_000);

describe("checkAuthorizationUpdated against a real database", () => {
  test("central-only decisions match the deleted legacy path on every live shape", async () => {
    const shapes = buildShapes(scenario.workspaceId);
    const disagreements: { current: boolean; legacy: boolean; shape: string; user: string }[] = [];

    for (const shape of shapes) {
      for (const user of scenario.users) {
        const current = await decidesAllow(user.userId, scenario.organizationId, shape.access);
        const legacy = await replayDeletedLegacyPath(user.userId, scenario.organizationId, shape.access);
        if (current !== legacy) {
          disagreements.push({ current, legacy, shape: shape.name, user: user.name });
        }
      }
    }

    expect(disagreements).toEqual([]);
    // Guard against a vacuous pass: the matrix must actually have been evaluated.
    expect(shapes.length * scenario.users.length).toBe(56);
  });

  test("a denial is still a throw, and an empty requirement list denies", async () => {
    const nonMember = scenario.users.find((user) => user.name === "non-member");

    await expect(
      checkAuthorizationUpdated({
        userId: nonMember!.userId,
        organizationId: scenario.organizationId,
        access: [{ type: "organization", roles: ["owner", "manager"] }],
      })
    ).rejects.toThrow("Not authorized");

    const owner = scenario.users.find((user) => user.name === "owner");

    await expect(
      checkAuthorizationUpdated({
        userId: owner!.userId,
        organizationId: scenario.organizationId,
        access: [],
      })
    ).rejects.toThrow("Not authorized");
  });
});
