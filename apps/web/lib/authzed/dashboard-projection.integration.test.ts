import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";
import { runAuthzedBackfill } from "./backfill";
import { createAuthzedBackfillApply, createAuthzedBackfillNoopApply } from "./backfill-apply";
import { getAuthzedClient } from "./client";
import { AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN } from "./constants";
import { drainAuthzedOutbox } from "./outbox-processor";

/**
 * ADR-0059 against a real PostgreSQL and SpiceDB: dashboard, page and team-limit writes → triggers →
 * outbox → projectors → graph → `dashboard#read` / `dashboard_page#read`, plus the grant/revocation
 * classification of each write and the backfill covering the new types.
 */

const client = () => getAuthzedClient();

const drain = async (): Promise<void> => {
  const result = await drainAuthzedOutbox();
  expect(result).toMatchObject({ deadLettered: 0, failed: 0, status: "drained" });
};

const canRead = async (resourceType: "dashboard" | "dashboard_page", resourceId: string, userId: string) =>
  (
    await client().checkPermission({
      permission: "read",
      resource: { objectId: resourceId, objectType: resourceType },
      subject: { objectId: userId, objectType: "user" },
    })
  ).allowed;

/**
 * What the writes since the last drain queued, as `targetType:grant|revocation`. Sorted: the rows one
 * statement queues share a timestamp, so their order is not theirs to assert.
 */
const queued = async (): Promise<ReadonlyArray<string>> =>
  (
    await prisma.authzedProjectionOutbox.findMany({
      where: { processedAt: null },
      select: { isRevocation: true, targetType: true },
    })
  )
    .map(({ isRevocation, targetType }) => `${targetType}:${isRevocation ? "revocation" : "grant"}`)
    .sort();

const seed = async () => {
  const organization = await prisma.organization.create({ data: { name: "Dashboard Access Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Dashboard Access Workspace", organizationId: organization.id },
  });
  const user = async (label: string, role: "dashboard_viewer" | "member" | "owner") => {
    const created = await prisma.user.create({
      data: { email: `${label}@dashboard-projection.test`, name: label },
    });
    await prisma.membership.create({
      data: { accepted: true, organizationId: organization.id, role, userId: created.id },
    });
    return created.id;
  };
  const team = async (name: string, userIds: ReadonlyArray<string>) => {
    const created = await prisma.team.create({ data: { name, organizationId: organization.id } });
    await prisma.teamUser.createMany({
      data: userIds.map((userId) => ({ role: "contributor" as const, teamId: created.id, userId })),
    });
    await prisma.workspaceTeam.create({
      data: { permission: "read", teamId: created.id, workspaceId: workspace.id },
    });
    return created.id;
  };

  const owner = await user("owner", "owner");
  const member = await user("member", "member");
  const red = await user("red", "dashboard_viewer");
  const blue = await user("blue", "dashboard_viewer");
  const redTeam = await team("Red", [red, member]);
  const blueTeam = await team("Blue", [blue]);

  const dashboard = async (name: string) => {
    const created = await prisma.dashboard.create({ data: { name, workspaceId: workspace.id } });
    const page = await prisma.dashboardPage.create({ data: { dashboardId: created.id, name: "Overview" } });
    return { id: created.id, pageId: page.id };
  };
  const one = await dashboard("One");
  const two = await dashboard("Two");
  await drain();

  return { blue, blueTeam, member, one, owner, red, redTeam, two, workspace };
};

beforeEach(async () => {
  await resetDb();
  await synchronizeAuthzedIntegrationFixture();
});

describe("dashboard and page projection through the outbox", () => {
  test("a team without a dashboard limit reaches every dashboard and every open page", async () => {
    const { blue, one, owner, red, two } = await seed();

    for (const userId of [owner, red, blue]) {
      await expect(canRead("dashboard", one.id, userId)).resolves.toBe(true);
      await expect(canRead("dashboard", two.id, userId)).resolves.toBe(true);
      await expect(canRead("dashboard_page", two.pageId, userId)).resolves.toBe(true);
    }
  });

  test("a team's dashboard limit narrows its viewers, and lifting it widens them again", async () => {
    const { blue, member, one, red, redTeam, two } = await seed();

    await prisma.teamDashboard.create({ data: { dashboardId: one.id, teamId: redTeam } });
    // The team's first selection narrows its viewers: the marker is queued as a revocation.
    expect(await queued()).toEqual(["dashboard:grant", "team:revocation"]);
    await drain();

    await expect(canRead("dashboard", one.id, red)).resolves.toBe(true);
    await expect(canRead("dashboard", two.id, red)).resolves.toBe(false);
    await expect(canRead("dashboard_page", two.pageId, red)).resolves.toBe(false);
    // Members are never limited; the other team is untouched.
    await expect(canRead("dashboard", two.id, member)).resolves.toBe(true);
    await expect(canRead("dashboard", two.id, blue)).resolves.toBe(true);

    await prisma.teamDashboard.deleteMany({ where: { teamId: redTeam } });
    expect(await queued()).toEqual(["dashboard:revocation", "team:grant"]);
    await drain();

    await expect(canRead("dashboard", two.id, red)).resolves.toBe(true);
  });

  test("a selection counts only while the team holds the dashboard's workspace", async () => {
    const { one, red, redTeam, workspace } = await seed();
    await prisma.teamDashboard.create({ data: { dashboardId: one.id, teamId: redTeam } });
    await drain();
    await expect(canRead("dashboard", one.id, red)).resolves.toBe(true);

    await prisma.workspaceTeam.delete({
      where: { workspaceId_teamId: { teamId: redTeam, workspaceId: workspace.id } },
    });
    await drain();

    const { relationships } = await client().readRelationships({
      filter: { resourceId: one.id, resourceType: "dashboard" },
      limit: 100,
    });
    expect(relationships.map(({ relation }) => relation)).toEqual(["workspace"]);
    await expect(canRead("dashboard", one.id, red)).resolves.toBe(false);
  });

  test("a page limit narrows within the dashboard, and the page reopens with its last limit gone", async () => {
    const { blue, blueTeam, member, one, red, redTeam } = await seed();

    await prisma.dashboardPageTeam.create({ data: { pageId: one.pageId, teamId: redTeam } });
    expect(await queued()).toEqual(["dashboard_page:revocation"]);
    await drain();

    await expect(canRead("dashboard_page", one.pageId, red)).resolves.toBe(true);
    await expect(canRead("dashboard_page", one.pageId, member)).resolves.toBe(true);
    await expect(canRead("dashboard_page", one.pageId, blue)).resolves.toBe(false);
    // The page limit never takes the dashboard away.
    await expect(canRead("dashboard", one.id, blue)).resolves.toBe(true);

    await prisma.dashboardPageTeam.create({ data: { pageId: one.pageId, teamId: blueTeam } });
    await drain();
    await prisma.dashboardPageTeam.delete({
      where: { pageId_teamId: { pageId: one.pageId, teamId: blueTeam } },
    });
    // Red's limit stays, so Blue's viewers lose the page again.
    expect(await queued()).toEqual(["dashboard_page:revocation"]);
    await drain();
    await expect(canRead("dashboard_page", one.pageId, blue)).resolves.toBe(false);

    await prisma.dashboardPageTeam.deleteMany({ where: { pageId: one.pageId } });
    expect(await queued()).toEqual(["dashboard_page:grant"]);
    await drain();
    await expect(canRead("dashboard_page", one.pageId, blue)).resolves.toBe(true);
  });

  test("deleting a dashboard queues no revocation and removes its and its pages' edges", async () => {
    const { one, redTeam } = await seed();
    await prisma.teamDashboard.create({ data: { dashboardId: one.id, teamId: redTeam } });
    await prisma.dashboardPageTeam.create({ data: { pageId: one.pageId, teamId: redTeam } });
    await drain();

    await prisma.dashboard.delete({ where: { id: one.id } });
    expect((await queued()).filter((entry) => entry.endsWith("revocation"))).toEqual([]);
    await drain();

    for (const [resourceType, resourceId] of [
      ["dashboard", one.id],
      ["dashboard_page", one.pageId],
    ] as const) {
      const { relationships } = await client().readRelationships({
        filter: { resourceId, resourceType },
        limit: 100,
      });
      expect(relationships).toEqual([]);
    }
  });

  test("the backfill restores dashboards, pages and team markers into an emptied graph", async () => {
    const { one, red, redTeam, two } = await seed();
    await prisma.teamDashboard.create({ data: { dashboardId: one.id, teamId: redTeam } });
    await prisma.dashboardPageTeam.create({ data: { pageId: two.pageId, teamId: redTeam } });
    await drain();

    for (const [resourceType, resourceId] of [
      ["dashboard", one.id],
      ["dashboard", two.id],
      ["dashboard_page", one.pageId],
      ["dashboard_page", two.pageId],
    ] as const) {
      await client().deleteRelationships({ resourceId, resourceType });
    }
    await client().deleteRelationships({
      relation: "dashboard_limited",
      resourceId: redTeam,
      resourceType: "team",
    });

    const request = {
      maxPrune: AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN,
      prune: false,
      scope: { kind: "all" },
    } as const;
    const drift = await runAuthzedBackfill(
      { ...request, mode: "dry_run" },
      { apply: createAuthzedBackfillNoopApply(), client: client() }
    );
    expect(drift.status).toBe("drifted");
    // Two dashboards and two pages are missing; the team marker is a mismatched relation set on its team.
    expect(drift.counters.missing).toBe(4);
    expect(drift.mismatchedPermissions).toContainEqual(
      expect.objectContaining({
        expectedRelations: ["dashboard_limited"],
        source: { kind: "team", teamId: redTeam },
      })
    );

    await runAuthzedBackfill(
      { ...request, mode: "apply" },
      { apply: createAuthzedBackfillApply(), client: client() }
    );
    const audit = await runAuthzedBackfill(
      { ...request, mode: "dry_run" },
      { apply: createAuthzedBackfillNoopApply(), client: client() }
    );
    expect(audit.status).toBe("reconciled");
    await expect(canRead("dashboard", two.id, red)).resolves.toBe(false);
    await expect(canRead("dashboard", one.id, red)).resolves.toBe(true);
  });
});
