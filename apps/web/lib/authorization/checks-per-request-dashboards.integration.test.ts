import { beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { can } from "@/lib/authorization";
import { getIssuedAuthorizationCheckCount, withAuthorizationSurface } from "@/lib/authorization/context";
import { getDashboards } from "@/modules/ee/analysis/dashboards/lib/dashboards";

/**
 * ENG-1739 follow-up: the same N+1 proof `checks-per-request.integration.test.ts` gives the survey
 * list, for the dashboard list. `getDashboards` runs no authorization of its own — the gate is the
 * workspace check a dashboard page resolves once — so the claim under test is the same one: fetching
 * many dashboards costs the same single check as fetching few.
 */
const scenario: { organizationId: string; userId: string; workspaceId: string } = {
  organizationId: "",
  userId: "",
  workspaceId: "",
};

const DASHBOARD_COUNTS = [10, 500] as const;

beforeAll(async () => {
  await resetDb();

  const organization = await prisma.organization.create({ data: { name: "Dashboard Checks Org" } });
  const user = await prisma.user.create({ data: { name: "owner", email: "owner@dashboard-checks.test" } });
  await prisma.membership.create({
    data: { userId: user.id, organizationId: organization.id, role: "owner", accepted: true },
  });
  const workspace = await prisma.workspace.create({
    data: { name: "Dashboard Checks Workspace", organizationId: organization.id },
  });

  scenario.organizationId = organization.id;
  scenario.userId = user.id;
  scenario.workspaceId = workspace.id;
}, 120_000);

describe("dashboard list authorization amplification, against a real database", () => {
  test.each(DASHBOARD_COUNTS)(
    "fetching a workspace's dashboards costs exactly one check, with %d dashboards present",
    async (dashboardCount) => {
      await prisma.dashboard.deleteMany({ where: { workspaceId: scenario.workspaceId } });
      await prisma.dashboard.createMany({
        data: Array.from({ length: dashboardCount }, (_unused, index) => ({
          name: `dashboard-${index}`,
          workspaceId: scenario.workspaceId,
        })),
      });

      const result = await withAuthorizationSurface("server_action", async () => {
        const canRead = await can({ type: "user", id: scenario.userId }, "workspace.read", {
          type: "workspace",
          id: scenario.workspaceId,
        });
        expect(canRead).toBe(true);

        const dashboards = await getDashboards(scenario.workspaceId);
        return { checksIssued: getIssuedAuthorizationCheckCount(), rowCount: dashboards.length };
      });

      expect(result.rowCount).toBe(dashboardCount);
      expect(result.checksIssued).toBe(1);
    }
  );
});
