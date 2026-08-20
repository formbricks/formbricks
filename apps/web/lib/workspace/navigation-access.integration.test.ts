import { beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";
import { canUserNavigateWorkspace } from "@/lib/workspace/auth";

/**
 * ENG-1737: proof that replacing `hasUserWorkspaceAccess` did not move the boundary.
 *
 * The claim the migration rests on is an equivalence over the whole role/grant space, and a mocked
 * `can()` cannot test it — mocking the decision is assuming the answer. So this drives the real
 * `canUserNavigateWorkspace` (real `can()`, real SpiceDB evaluator, real Prisma) against a projected
 * PostgreSQL fixture, and compares every case to the deleted helper's own logic, replayed below
 * against the same rows.
 *
 * `expectedByOldHelper` is not a restatement of what the new code does; it is a transcription of the
 * query the old one ran (`git show origin/epic/authzed:apps/web/lib/workspace/auth.ts`):
 *
 *   1. a Membership for this user in the organization that owns the workspace, else false
 *   2. role owner | manager | billing → true
 *   3. otherwise a TeamUser row on a team holding any WorkspaceTeam grant for this workspace
 */
const replayDeletedHelper = async (userId: string, workspaceId: string): Promise<boolean> => {
  const orgMembership = await prisma.membership.findFirst({
    where: { userId, organization: { workspaces: { some: { id: workspaceId } } } },
  });

  if (!orgMembership) return false;
  if (["owner", "manager", "billing"].includes(orgMembership.role)) return true;

  const teamMembership = await prisma.teamUser.findFirst({
    where: { userId, team: { workspaceTeams: { some: { workspaceId } } } },
  });

  return teamMembership !== null;
};

type TCase = Readonly<{ expected: boolean; name: string; userId: string }>;

const scenario: {
  cases: TCase[];
  otherWorkspaceId: string;
  workspace: { id: string; organizationId: string };
} = { cases: [], otherWorkspaceId: "", workspace: { id: "", organizationId: "" } };

const createMember = async (
  email: string,
  organizationId: string,
  role: TOrganizationRole | null
): Promise<string> => {
  const user = await prisma.user.create({ data: { name: email, email } });
  if (role) {
    await prisma.membership.create({ data: { userId: user.id, organizationId, role, accepted: true } });
  }
  return user.id;
};

beforeAll(async () => {
  await resetDb();

  const organization = await prisma.organization.create({ data: { name: "Nav Org" } });
  const otherOrganization = await prisma.organization.create({ data: { name: "Other Org" } });

  const workspace = await prisma.workspace.create({
    data: { name: "Nav Workspace", organizationId: organization.id },
  });
  const otherWorkspace = await prisma.workspace.create({
    data: { name: "Ungranted Workspace", organizationId: organization.id },
  });

  // A team holding a read grant on `workspace` only.
  const grantedTeam = await prisma.team.create({
    data: { name: "Granted", organizationId: organization.id },
  });
  await prisma.workspaceTeam.create({
    data: { teamId: grantedTeam.id, workspaceId: workspace.id, permission: "read" },
  });
  // A team with no workspace grant at all.
  const ungrantedTeam = await prisma.team.create({
    data: { name: "Ungranted", organizationId: organization.id },
  });

  const owner = await createMember("owner@nav.test", organization.id, "owner");
  const manager = await createMember("manager@nav.test", organization.id, "manager");
  const billing = await createMember("billing@nav.test", organization.id, "billing");
  const grantedMember = await createMember("granted@nav.test", organization.id, "member");
  const ungrantedMember = await createMember("ungranted@nav.test", organization.id, "member");
  const teamlessMember = await createMember("teamless@nav.test", organization.id, "member");
  const stranger = await createMember("stranger@nav.test", organization.id, null);
  const otherOrgOwner = await createMember("other-owner@nav.test", otherOrganization.id, "owner");
  // A team row that outlived its membership — `TeamUser` cascades from `Team` and `User`, never
  // from `Membership`. Both implementations refuse it, and for the same reason: the legacy
  // evaluator behind `workspace.read` opens with the same membership query the deleted helper did.
  // So this row does NOT exercise the explicit precondition in canUserNavigateWorkspace (the matrix
  // passes with that line removed); it pins that the state is refused at all.
  const removedMember = await createMember("removed@nav.test", organization.id, null);

  await prisma.teamUser.createMany({
    data: [
      { teamId: grantedTeam.id, userId: grantedMember, role: "contributor" },
      { teamId: ungrantedTeam.id, userId: ungrantedMember, role: "contributor" },
      { teamId: grantedTeam.id, userId: removedMember, role: "contributor" },
    ],
  });

  scenario.workspace = { id: workspace.id, organizationId: organization.id };
  scenario.otherWorkspaceId = otherWorkspace.id;
  scenario.cases = [
    { expected: true, name: "owner, no team grant", userId: owner },
    { expected: true, name: "manager, no team grant", userId: manager },
    { expected: true, name: "billing, no team grant", userId: billing },
    { expected: true, name: "member with a team grant on this workspace", userId: grantedMember },
    { expected: false, name: "member whose team holds no grant here", userId: ungrantedMember },
    { expected: false, name: "member on no team at all", userId: teamlessMember },
    { expected: false, name: "user with no membership anywhere", userId: stranger },
    { expected: false, name: "owner of a different organization", userId: otherOrgOwner },
    { expected: false, name: "removed member whose team row survived", userId: removedMember },
  ];
  await synchronizeAuthzedIntegrationFixture();
}, 120_000);

describe("canUserNavigateWorkspace against a real database", () => {
  test("the role/grant matrix is decided the same way the deleted helper decided it", async () => {
    const rows = await Promise.all(
      scenario.cases.map(async (testCase) => ({
        name: testCase.name,
        expected: testCase.expected,
        old: await replayDeletedHelper(testCase.userId, scenario.workspace.id),
        current: await canUserNavigateWorkspace(testCase.userId, scenario.workspace),
      }))
    );

    // One assertion over the whole matrix so a failure prints every disagreeing row at once.
    expect(rows).toEqual(
      scenario.cases.map((testCase) => ({
        name: testCase.name,
        expected: testCase.expected,
        old: testCase.expected,
        current: testCase.expected,
      }))
    );
  });

  test("a grant on one workspace does not carry to a sibling workspace", async () => {
    const grantedMember = scenario.cases.find((testCase) =>
      testCase.name.startsWith("member with a team grant")
    );

    const sibling = {
      id: scenario.otherWorkspaceId,
      organizationId: scenario.workspace.organizationId,
    };

    expect(await canUserNavigateWorkspace(grantedMember!.userId, sibling)).toBe(false);
    expect(await replayDeletedHelper(grantedMember!.userId, sibling.id)).toBe(false);
  });
});
