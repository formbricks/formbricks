import { beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { can } from "@/lib/authorization";
import { getIssuedAuthorizationCheckCount, withAuthorizationSurface } from "@/lib/authorization/context";
import { getSurveyListPage } from "@/modules/survey/list/lib/survey-page";

/**
 * ENG-1739 — the ticket's central claim, proven rather than argued.
 *
 * Everything else this ticket produced (`authzed-perf.ts`) times a single authorization decision. It
 * cannot see whether a page or endpoint issues one decision or one per row — a regression that made
 * the survey list check once per survey would still report "fast" checks. Only a per-request count
 * can see that, which is what `getIssuedAuthorizationCheckCount` exists for.
 *
 * The real list path is exactly what a workspace's survey list page uses: one `workspace.read`
 * decision (what `getWorkspaceAuth` asks), then `getSurveyListPage` to fetch the rows. The list query
 * runs no authorization of its own — access was already established by the workspace check — so the
 * claim under test is that fetching many rows costs the same ONE check as fetching few.
 *
 * ENG-2388: these declare the `page` surface. They previously declared `server_action`, which was a
 * stand-in — the scenario is a page render, but no page surface existed to name. That substitution is
 * itself the bug ENG-2388 fixes, and it made the test quietly unfaithful: the checks it counted were
 * attributed to the wrong surface, so the histogram this file exists to defend reported page renders
 * as server-action traffic. Saying `page` here is both the accurate declaration and the end-to-end
 * proof that the new surface resolves a rollout target through the real `can()` and coordinator.
 */
const scenario: { organizationId: string; userId: string; workspaceId: string } = {
  organizationId: "",
  userId: "",
  workspaceId: "",
};

const SURVEY_COUNTS = [50, 3_000] as const;

beforeAll(async () => {
  await resetDb();

  const organization = await prisma.organization.create({ data: { name: "Checks Per Request Org" } });
  const user = await prisma.user.create({ data: { name: "owner", email: "owner@checks.test" } });
  await prisma.membership.create({
    data: { userId: user.id, organizationId: organization.id, role: "owner", accepted: true },
  });
  const workspace = await prisma.workspace.create({
    data: { name: "Checks Per Request Workspace", organizationId: organization.id },
  });

  scenario.organizationId = organization.id;
  scenario.userId = user.id;
  scenario.workspaceId = workspace.id;
}, 120_000);

describe("survey list authorization amplification, against a real database", () => {
  test.each(SURVEY_COUNTS)(
    "fetching a workspace's surveys costs exactly one check, with %d surveys present",
    async (surveyCount) => {
      await prisma.survey.deleteMany({ where: { workspaceId: scenario.workspaceId } });
      await prisma.survey.createMany({
        data: Array.from({ length: surveyCount }, (_unused, index) => ({
          name: `survey-${index}`,
          workspaceId: scenario.workspaceId,
          status: "inProgress" as const,
          type: "link" as const,
        })),
      });

      const surveys = await withAuthorizationSurface("page", async () => {
        const canRead = await can({ type: "user", id: scenario.userId }, "workspace.read", {
          type: "workspace",
          id: scenario.workspaceId,
        });
        expect(canRead).toBe(true);

        const page = await getSurveyListPage(scenario.workspaceId, {
          limit: surveyCount,
          cursor: null,
          sortBy: "updatedAt",
        });
        return { checksIssued: getIssuedAuthorizationCheckCount(), rowCount: page.surveys.length };
      });

      expect(surveys.rowCount).toBe(surveyCount);
      // The claim: one workspace-level decision, independent of how many rows it unlocked.
      expect(surveys.checksIssued).toBe(1);
    }
  );

  test("the check count does not grow between 50 and 3,000 surveys", async () => {
    const countFor = async (surveyCount: number): Promise<number> => {
      await prisma.survey.deleteMany({ where: { workspaceId: scenario.workspaceId } });
      await prisma.survey.createMany({
        data: Array.from({ length: surveyCount }, (_unused, index) => ({
          name: `growth-survey-${index}`,
          workspaceId: scenario.workspaceId,
          status: "inProgress" as const,
          type: "link" as const,
        })),
      });

      return withAuthorizationSurface("page", async () => {
        await can({ type: "user", id: scenario.userId }, "workspace.read", {
          type: "workspace",
          id: scenario.workspaceId,
        });
        await getSurveyListPage(scenario.workspaceId, {
          limit: surveyCount,
          cursor: null,
          sortBy: "updatedAt",
        });
        return getIssuedAuthorizationCheckCount() ?? -1;
      });
    };

    // Sequential, not concurrent: both calls reuse and rewrite the same workspace's surveys, so
    // running them together would race the delete/create of one against the other's read.
    const small = await countFor(50);
    const large = await countFor(3_000);
    // Asserted separately: a counter that stopped incrementing would read 0 for both, and
    // `large - small` would equal 0 vacuously — this was actually missed on first pass, caught only
    // by re-checking which assertion a mutation run left passing rather than trusting the tally.
    expect(small).toBeGreaterThan(0);
    // Not merely "both equal the same thing" — a 60x growth in rows produces zero growth in checks.
    // This is the O(1) claim the ticket asks for, stated as an equality a regression would break.
    expect(large - small).toBe(0);
  });
});

describe("survey list authorization amplification (member, not owner), against a real database", () => {
  /**
   * Separate from the owner tests above: owners short-circuit nearly every authorization path, so an
   * integration test that only exercises the owner role misses the scope-resolver and team-membership
   * code that members exercise. This variant sets up a member whose workspace access arrives through
   * team membership — the path real non-admin users take — and confirms the O(1) claim still holds.
   */
  const scenario = { organizationId: "", userId: "", workspaceId: "" };

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Member Checks Org" } });
    const user = await prisma.user.create({ data: { name: "member", email: "member@checks.test" } });
    await prisma.membership.create({
      data: { userId: user.id, organizationId: organization.id, role: "member", accepted: true },
    });
    const workspace = await prisma.workspace.create({
      data: { name: "Member Checks Workspace", organizationId: organization.id },
    });
    const team = await prisma.team.create({
      data: { name: "Member Checks Team", organizationId: organization.id },
    });
    await prisma.teamUser.create({
      data: { teamId: team.id, userId: user.id, role: "contributor" },
    });
    await prisma.workspaceTeam.create({
      data: { teamId: team.id, workspaceId: workspace.id, permission: "read" },
    });

    scenario.organizationId = organization.id;
    scenario.userId = user.id;
    scenario.workspaceId = workspace.id;
  }, 120_000);

  test("a member with team-based workspace access issues exactly one check for the survey list", async () => {
    await prisma.survey.createMany({
      data: Array.from({ length: 100 }, (_unused, index) => ({
        name: `member-survey-${index}`,
        workspaceId: scenario.workspaceId,
        status: "inProgress" as const,
        type: "link" as const,
      })),
    });

    const result = await withAuthorizationSurface("page", async () => {
      const canRead = await can({ type: "user", id: scenario.userId }, "workspace.read", {
        type: "workspace",
        id: scenario.workspaceId,
      });
      expect(canRead).toBe(true);

      const page = await getSurveyListPage(scenario.workspaceId, {
        limit: 100,
        cursor: null,
        sortBy: "updatedAt",
      });
      return { checksIssued: getIssuedAuthorizationCheckCount(), rowCount: page.surveys.length };
    });

    expect(result.rowCount).toBe(100);
    // Owner or member, the workspace-level decision is still one check.
    expect(result.checksIssued).toBe(1);
  });
});
