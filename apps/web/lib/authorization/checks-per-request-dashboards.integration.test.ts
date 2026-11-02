import { beforeAll, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { listV3Dashboards } from "@/app/api/v3/dashboards/lib/operations";
import { ZV3DashboardListQuery } from "@/app/api/v3/dashboards/lib/schemas";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { sessionOf } from "@/integration/dashboards-fixture";
import { resetDb } from "@/integration/reset-db";
import { getIssuedAuthorizationCheckCount, withAuthorizationSurface } from "@/lib/authorization/context";

vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardsEnabled: vi.fn(async () => true),
}));

/**
 * ENG-1739 follow-up: the same N+1 proof `checks-per-request.integration.test.ts` gives the survey
 * list, for the dashboard list — now `GET /api/v3/dashboards` (ENG-6591). The operation authorizes the
 * workspace once and never per row, so a page of many dashboards costs the same checks as a page of few.
 */
const scenario: { organizationId: string; userId: string; workspaceId: string } = {
  organizationId: "",
  userId: "",
  workspaceId: "",
};

const DASHBOARD_COUNTS = [10, 2_000] as const;

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
  await synchronizeAuthzedIntegrationFixture();
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

      const result = await withAuthorizationSurface("api_v3", async () => {
        const response = await listV3Dashboards({
          query: ZV3DashboardListQuery.parse({ workspaceId: scenario.workspaceId, limit: "250" }),
          authentication: sessionOf(scenario.userId),
          requestId: "req",
          instance: "/api/v3/dashboards",
        });
        expect(response.status).toBe(200);
        const { data } = (await response.json()) as { data: unknown[] };
        return { checksIssued: getIssuedAuthorizationCheckCount(), rowCount: data.length };
      });

      expect(result.rowCount).toBe(Math.min(dashboardCount, 250));
      expect(result.checksIssued).toBe(1);
    }
  );
});
