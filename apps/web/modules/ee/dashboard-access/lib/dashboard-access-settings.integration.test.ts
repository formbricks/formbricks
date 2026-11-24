import { beforeAll, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  getV3DatasetViewerAccess,
  replaceV3DatasetViewerAccess,
} from "@/app/api/v3/feedback-datasets/lib/operations";
import { getV3TeamDashboardLimits, replaceV3TeamDashboardLimits } from "@/app/api/v3/teams/lib/operations";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { createTestDashboard } from "@/integration/dashboard-rows";
import { type TDashboardsFixture, seedDashboardsFixture, sessionOf } from "@/integration/dashboards-fixture";
import { updateTeamDetails } from "@/modules/ee/teams/team-list/lib/team";

/**
 * The dashboard access settings against real PostgreSQL and SpiceDB (ENG-7476, ENG-7483): a Feedback
 * Dataset's Dashboard Viewer access and a team's dashboard limits, through their v3 operations.
 */

vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardViewerRoleEnabled: vi.fn(async () => true),
}));

let fixture: TDashboardsFixture;
const ids = { key: "", team: "", dashboard: "", otherDashboard: "" };
const ctx = (userId: string) => ({ authentication: sessionOf(userId), requestId: "req", instance: "/x" });

beforeAll(async () => {
  fixture = await seedDashboardsFixture();
  ids.key = (
    await prisma.memberAttributeKey.create({
      data: { organizationId: fixture.organizationId, key: "region", label: "Region" },
    })
  ).id;
  ids.team = (
    await prisma.team.create({ data: { name: "Limited", organizationId: fixture.organizationId } })
  ).id;
  await prisma.workspaceTeam.create({
    data: { teamId: ids.team, workspaceId: fixture.workspaceId, permission: "read" },
  });
  ids.dashboard = (
    await createTestDashboard({
      data: { name: "Mine", workspaceId: fixture.workspaceId, createdBy: fixture.users.owner },
    })
  ).id;
  ids.otherDashboard = (
    await createTestDashboard({
      data: { name: "Elsewhere", workspaceId: fixture.otherWorkspaceId, createdBy: fixture.users.owner },
    })
  ).id;
  await synchronizeAuthzedIntegrationFixture();
}, 120_000);

describe("a Feedback Dataset's Dashboard Viewer access", () => {
  test("an Owner reads and replaces it; a stale version answers 409", async () => {
    const read = await getV3DatasetViewerAccess({
      datasetId: fixture.datasetId,
      ...ctx(fixture.users.owner),
    });
    expect(read.status).toBe(200);
    const { updatedAt } = ((await read.json()) as { data: { updatedAt: string } }).data;

    const auditLog = {} as never as Record<string, unknown>;
    const replaced = await replaceV3DatasetViewerAccess({
      datasetId: fixture.datasetId,
      body: {
        join: "any",
        conditions: [
          { field: "FeedbackRecords.metadataCountry", attributeKeyId: ids.key },
          { field: "ed:team", attributeKeyId: null },
        ],
        expectedUpdatedAt: updatedAt,
      },
      auditLog: auditLog as never,
      ...ctx(fixture.users.owner),
    });
    expect(replaced.status, await replaced.clone().text()).toBe(200);
    expect(((await replaced.json()) as { data: unknown }).data).toMatchObject({
      join: "any",
      conditions: [
        { field: "FeedbackRecords.metadataCountry", fieldLabel: "Country", attributeLabel: "Region" },
        { field: "ed:team", fieldLabel: "team", attributeKeyId: null, attributeLabel: "Email" },
      ],
    });
    expect(auditLog).toMatchObject({ targetId: fixture.datasetId, organizationId: fixture.organizationId });

    const stale = await replaceV3DatasetViewerAccess({
      datasetId: fixture.datasetId,
      body: { join: "all", conditions: [], expectedUpdatedAt: updatedAt },
      ...ctx(fixture.users.owner),
    });
    expect(stale.status).toBe(409);
  });

  test("refuses an answer field, and a Member attribute of another organization, with 422", async () => {
    const { updatedAt } = (
      (await (
        await getV3DatasetViewerAccess({ datasetId: fixture.datasetId, ...ctx(fixture.users.owner) })
      ).json()) as { data: { updatedAt: string } }
    ).data;
    const refused = await replaceV3DatasetViewerAccess({
      datasetId: fixture.datasetId,
      body: {
        join: "all",
        conditions: [
          { field: "FeedbackRecords.valueText", attributeKeyId: null },
          { field: "FeedbackRecords.language", attributeKeyId: "clak000000000000000000009" },
        ],
        expectedUpdatedAt: updatedAt,
      },
      ...ctx(fixture.users.owner),
    });
    expect(refused.status).toBe(422);
  });

  test("a Member, and another organization's dataset, answer 403", async () => {
    expect(
      (await getV3DatasetViewerAccess({ datasetId: fixture.datasetId, ...ctx(fixture.users.editor) })).status
    ).toBe(403);
    expect(
      (await getV3DatasetViewerAccess({ datasetId: fixture.foreignDatasetId, ...ctx(fixture.users.owner) }))
        .status
    ).toBe(403);
  });
});

describe("a team's dashboard limits", () => {
  test("refuses a dashboard outside the team's workspaces, and offers every dashboard of the organization", async () => {
    const refused = await replaceV3TeamDashboardLimits({
      teamId: ids.team,
      body: { dashboardIds: [ids.otherDashboard] },
      ...ctx(fixture.users.owner),
    });
    expect(refused.status).toBe(422);

    const set = await replaceV3TeamDashboardLimits({
      teamId: ids.team,
      body: { dashboardIds: [ids.dashboard] },
      ...ctx(fixture.users.owner),
    });
    expect(set.status, await set.clone().text()).toBe(200);
    const read = await getV3TeamDashboardLimits({ teamId: ids.team, ...ctx(fixture.users.owner) });
    expect(((await read.json()) as { data: unknown }).data).toEqual({
      teamId: ids.team,
      limited: true,
      dashboardIds: [ids.dashboard],
      dashboards: [
        { id: ids.dashboard, name: "Mine", workspaceId: fixture.workspaceId, workspaceName: "Dashboards" },
        // The options span the organization: the team settings narrow them to the workspaces picked in the form.
        {
          id: ids.otherDashboard,
          name: "Elsewhere",
          workspaceId: fixture.otherWorkspaceId,
          workspaceName: "Other",
        },
      ],
    });
    expect((await getV3TeamDashboardLimits({ teamId: ids.team, ...ctx(fixture.users.editor) })).status).toBe(
      403
    );
  });

  test("losing the workspace grant removes the team's limits there", async () => {
    await updateTeamDetails(ids.team, {
      name: "Limited",
      members: [],
      workspaces: [{ workspaceId: fixture.otherWorkspaceId, permission: "read" }],
    });
    await expect(prisma.teamDashboard.count({ where: { teamId: ids.team } })).resolves.toBe(0);
  });
});
