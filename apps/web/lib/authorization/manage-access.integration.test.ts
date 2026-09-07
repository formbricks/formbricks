import { beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";
import { can } from "@/lib/authorization";
import { USER_MANAGEMENT_MINIMUM_ROLE } from "@/lib/constants";
import { getUserManagementAccess } from "@/lib/membership/utils";

/**
 * ENG-1737 (review follow-up): the two capabilities that reviewer feedback moved onto the central
 * interface, decided against real rows.
 *
 * Both replacements are equivalence claims, so they get the same treatment as the rest of this
 * change rather than a mocked assertion of what the code now does:
 *
 *   - `organization.manage_access` must answer exactly what the inline
 *     `getUserManagementAccess(role, USER_MANAGEMENT_MINIMUM_ROLE)` answered in the membership-update
 *     action. That helper is the comparison below, so the test tracks the deployment's configured
 *     floor instead of hardcoding one — an install set to `owner` or `disabled` asserts against its
 *     own policy. (Varying the constant per case would need module-level env mocking, which the unit
 *     suite is the right place for; here the point is that the two agree under whatever is set.)
 *
 *   - `team.manage` must answer exactly "is a team admin, or an organization owner/manager", which is
 *     what `getTeamsWhereUserIsAdmin` plus the owner/manager branch established in the invite action.
 */
const scenario: {
  organizationId: string;
  otherTeamId: string;
  teamId: string;
  userIdByLabel: Map<string, string>;
} = { organizationId: "", otherTeamId: "", teamId: "", userIdByLabel: new Map() };

const ORGANIZATION_ROLES: ReadonlyArray<TOrganizationRole> = ["owner", "manager", "member", "billing"];

beforeAll(async () => {
  await resetDb();

  const organization = await prisma.organization.create({ data: { name: "Manage Access Org" } });
  const team = await prisma.team.create({ data: { name: "Team A", organizationId: organization.id } });
  const otherTeam = await prisma.team.create({ data: { name: "Team B", organizationId: organization.id } });

  const makeUser = async (
    label: string,
    role: TOrganizationRole | null,
    teamMembership?: { role: "admin" | "contributor"; teamId: string }
  ) => {
    const user = await prisma.user.create({ data: { name: label, email: `${label}@manage.test` } });
    if (role) {
      await prisma.membership.create({
        data: { userId: user.id, organizationId: organization.id, role, accepted: true },
      });
    }
    if (teamMembership) {
      await prisma.teamUser.create({
        data: { teamId: teamMembership.teamId, userId: user.id, role: teamMembership.role },
      });
    }
    scenario.userIdByLabel.set(label, user.id);
  };

  for (const role of ORGANIZATION_ROLES) {
    await makeUser(role, role);
  }
  await makeUser("team-admin", "member", { role: "admin", teamId: team.id });
  await makeUser("team-contributor", "member", { role: "contributor", teamId: team.id });
  await makeUser("outsider", null);

  scenario.organizationId = organization.id;
  scenario.teamId = team.id;
  scenario.otherTeamId = otherTeam.id;
  await synchronizeAuthzedIntegrationFixture();
}, 120_000);

describe("organization.manage_access against a real database", () => {
  test.each(ORGANIZATION_ROLES)(
    "matches getUserManagementAccess for the %s role under the configured floor",
    async (role) => {
      const expected = getUserManagementAccess(role, USER_MANAGEMENT_MINIMUM_ROLE);

      const actual = await can(
        { type: "user", id: scenario.userIdByLabel.get(role)! },
        "organization.manage_access",
        { type: "organization", id: scenario.organizationId }
      );

      expect(actual).toBe(expected);
    }
  );

  test("refuses a user outside the organization regardless of the floor", async () => {
    const actual = await can(
      { type: "user", id: scenario.userIdByLabel.get("outsider")! },
      "organization.manage_access",
      { type: "organization", id: scenario.organizationId }
    );

    expect(actual).toBe(false);
  });
});

describe("team.manage against a real database", () => {
  test.each([
    ["owner", true],
    ["manager", true],
    ["team-admin", true],
    ["team-contributor", false],
    ["member", false],
    ["billing", false],
    ["outsider", false],
  ] as const)("decides %s as %s for a team they may be admin of", async (label, expected) => {
    const actual = await can({ type: "user", id: scenario.userIdByLabel.get(label)! }, "team.manage", {
      type: "team",
      id: scenario.teamId,
    });

    expect(actual).toBe(expected);
  });

  // The reason the invite path asks per requested team rather than once: admin of one team is not
  // admin of another, and the invite writes to exactly the teams it names.
  test("does not carry a team admin's authority to a sibling team", async () => {
    const actual = await can({ type: "user", id: scenario.userIdByLabel.get("team-admin")! }, "team.manage", {
      type: "team",
      id: scenario.otherTeamId,
    });

    expect(actual).toBe(false);
  });
});
