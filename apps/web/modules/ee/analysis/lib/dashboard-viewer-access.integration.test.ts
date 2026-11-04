import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getV3ChartData, previewV3Chart } from "@/app/api/v3/charts/lib/data-operations";
import { listV3ChartFieldValues } from "@/app/api/v3/charts/lib/field-operations";
import { createV3Chart, getV3Chart, listV3Charts } from "@/app/api/v3/charts/lib/operations";
import {
  ZV3ChartDataQuery,
  ZV3ChartFieldValuesQuery,
  ZV3ChartListQuery,
  ZV3ChartPreviewBody,
} from "@/app/api/v3/charts/lib/schemas";
import { listV3Contacts } from "@/app/api/v3/contacts/lib/operations";
import { getV3DashboardChartData } from "@/app/api/v3/dashboards/lib/chart-data-operations";
import { listV3DashboardFilterValues } from "@/app/api/v3/dashboards/lib/filter-values-operations";
import {
  createV3Dashboard,
  deleteV3Dashboard,
  duplicateV3Dashboard,
  getV3Dashboard,
  listV3Dashboards,
  renameV3Dashboard,
} from "@/app/api/v3/dashboards/lib/operations";
import {
  ZV3DashboardChartDataQuery,
  ZV3DashboardFilterValuesQuery,
  ZV3DashboardListQuery,
} from "@/app/api/v3/dashboards/lib/schemas";
import { getV3DashboardWidget } from "@/app/api/v3/dashboards/lib/widget-operations";
import {
  getV3FeedbackRecord,
  listV3FeedbackDatasets,
  listV3FeedbackRecords,
} from "@/app/api/v3/feedbackRecords/lib/operations";
import {
  refuseUnlessFeedbackDatasetAccess,
  requireDashboardsAccess,
} from "@/app/api/v3/lib/dashboards-access";
import { getV3Response, listV3Responses } from "@/app/api/v3/responses/lib/operations";
import { getV3Survey, listV3Surveys } from "@/app/api/v3/surveys/lib/operations";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { type TDashboardsFixture, seedDashboardsFixture, sessionOf } from "@/integration/dashboards-fixture";
import { can } from "@/lib/authorization";
import { cache } from "@/lib/cache";
import { getWorkspaceMembers } from "@/lib/workspace/service";
import { updateMembership } from "@/modules/ee/role-management/lib/membership";
import { feedbackRecordsGatewayAuthorizer } from "@/modules/hub/feedback-records-gateway";
import {
  getDashboardViewerHomePath,
  getDashboardViewerWorkspaceState,
  listDashboardViewerOrganizations,
  listDashboardViewerWorkspaces,
} from "./dashboard-viewer-access";

/**
 * The Dashboard viewer (ADR-0023, ENG-6899 / ENG-6903) against real PostgreSQL and SpiceDB: what a viewer
 * may and may not reach, operation by operation. The role is the `organization#dashboard_viewer`
 * relation; SpiceDB grants it `workspace#dashboard_read` (and the dashboard-bound Feedback Dataset read)
 * on the workspaces its teams are granted, and denies it everything else.
 */

vi.mock("@cubejs-client/core", async (importOriginal) =>
  (await import("@/integration/cube-fake")).fakeCubeModule(await importOriginal())
);

const entitlement = vi.hoisted(() => ({ dashboards: true, viewerRole: true }));
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardsEnabled: vi.fn(async () => entitlement.dashboards),
  getIsDashboardViewerRoleEnabled: vi.fn(async () => entitlement.viewerRole && entitlement.dashboards),
  // The dashboard-bound reads read Access Control and Dashboards themselves; `viewerRole` stands for
  // Access Control here.
  getAccessControlPermission: vi.fn(async () => entitlement.viewerRole),
  getIsFeedbackDirectoriesEnabled: vi.fn(async () => true),
}));

const FILTER_ID = "clfi000000000000000000001";

let fixture: TDashboardsFixture;
const ids = {
  viewer: "",
  manageViewer: "",
  ungrantedViewer: "",
  foreignViewer: "",
  promoted: "",
  demoted: "",
  survey: "",
  response: "",
  chart: "",
  dashboard: "",
  emptyDashboardWorkspace: "",
  hiddenDashboard: "",
  widget: "",
};

const ctx = (userId: string, instance = "/api/v3/test") => ({
  authentication: sessionOf(userId),
  requestId: "req",
  instance,
});

const statusOf = async (response: Response) => response.status;

const addViewer = async (
  label: string,
  organizationId: string,
  grants: Array<{ workspaceId: string; permission: "read" | "readWrite" | "manage" }>,
  role: "dashboard_viewer" | "member" = "dashboard_viewer"
) => {
  const user = await prisma.user.create({ data: { email: `${label}@viewer.test`, name: label } });
  await prisma.membership.create({ data: { accepted: true, organizationId, role, userId: user.id } });
  if (grants.length > 0) {
    const team = await prisma.team.create({ data: { name: `${label} team`, organizationId } });
    await prisma.teamUser.create({ data: { role: "contributor", teamId: team.id, userId: user.id } });
    for (const grant of grants) {
      await prisma.workspaceTeam.create({ data: { ...grant, teamId: team.id } });
    }
  }
  return user.id;
};

beforeAll(async () => {
  fixture = await seedDashboardsFixture();
  const foreignWorkspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: fixture.foreignWorkspaceId },
    select: { organizationId: true },
  });
  const emptyWorkspace = await prisma.workspace.create({
    data: { name: "No dashboards", organizationId: fixture.organizationId },
  });
  ids.emptyDashboardWorkspace = emptyWorkspace.id;

  ids.viewer = await addViewer("viewer", fixture.organizationId, [
    { workspaceId: fixture.workspaceId, permission: "read" },
    { workspaceId: emptyWorkspace.id, permission: "read" },
  ]);
  ids.manageViewer = await addViewer("manage-viewer", fixture.organizationId, [
    { workspaceId: fixture.workspaceId, permission: "manage" },
  ]);
  ids.ungrantedViewer = await addViewer("ungranted-viewer", fixture.organizationId, []);
  // A viewer of another organization whose team is granted that organization's workspace only.
  ids.foreignViewer = await addViewer("foreign-viewer", foreignWorkspace.organizationId, [
    { workspaceId: fixture.foreignWorkspaceId, permission: "read" },
  ]);
  ids.promoted = await addViewer("promoted", fixture.organizationId, [
    { workspaceId: fixture.workspaceId, permission: "read" },
  ]);
  ids.demoted = await addViewer(
    "demoted",
    fixture.organizationId,
    [{ workspaceId: fixture.workspaceId, permission: "read" }],
    "member"
  );

  ids.survey = (
    await prisma.survey.create({
      data: { name: "Survey", ownerId: fixture.users.owner, workspaceId: fixture.workspaceId },
    })
  ).id;
  ids.response = (
    await prisma.response.create({ data: { data: {}, finished: true, surveyId: ids.survey } })
  ).id;
  await prisma.contact.create({ data: { workspaceId: fixture.workspaceId } });

  ids.chart = (
    await prisma.chart.create({
      data: {
        name: "Responses",
        type: "bar",
        workspaceId: fixture.workspaceId,
        feedbackDirectoryId: fixture.datasetId,
        query: { measures: ["FeedbackRecords.count"] },
        config: {},
      },
    })
  ).id;
  const dashboard = await prisma.dashboard.create({
    data: {
      name: "Visit NPS",
      workspaceId: fixture.workspaceId,
      createdBy: fixture.users.owner,
      filters: [{ id: FILTER_ID, field: "FeedbackRecords.sourceName", operator: "equals", label: "Source" }],
    },
  });
  ids.dashboard = dashboard.id;
  ids.widget = (
    await prisma.dashboardWidget.create({
      data: { dashboardId: dashboard.id, chartId: ids.chart, layout: { x: 0, y: 0, w: 4, h: 3 }, order: 0 },
    })
  ).id;
  ids.hiddenDashboard = (
    await prisma.dashboard.create({
      data: { name: "Hidden", workspaceId: fixture.otherWorkspaceId, createdBy: fixture.users.owner },
    })
  ).id;

  await synchronizeAuthzedIntegrationFixture();
}, 120_000);

beforeEach(() => {
  entitlement.dashboards = true;
  entitlement.viewerRole = true;
});

describe("SpiceDB denies a Dashboard viewer everything but dashboard reads", () => {
  test.each([
    ["organization.read", () => ({ type: "organization", id: fixture.organizationId })],
    ["organization.read_access", () => ({ type: "organization", id: fixture.organizationId })],
    ["workspace.read", () => ({ type: "workspace", id: fixture.workspaceId })],
    ["workspace.write", () => ({ type: "workspace", id: fixture.workspaceId })],
    ["workspace.manage", () => ({ type: "workspace", id: fixture.workspaceId })],
    ["workspace.share", () => ({ type: "workspace", id: fixture.workspaceId })],
    ["survey.read", () => ({ type: "survey", id: ids.survey })],
    ["survey.response_read", () => ({ type: "survey", id: ids.survey })],
    ["survey.response_export", () => ({ type: "survey", id: ids.survey })],
    ["response.read", () => ({ type: "response", id: ids.response })],
    ["response.export", () => ({ type: "response", id: ids.response })],
    ["dashboard.write", () => ({ type: "dashboard", id: ids.dashboard })],
    [
      "feedbackDirectoryAssignment.read",
      () => ({
        type: "feedbackDirectoryAssignment",
        feedbackDirectoryId: fixture.datasetId,
        workspaceId: fixture.workspaceId,
      }),
    ],
    ["feedbackDirectory.read", () => ({ type: "feedbackDirectory", id: fixture.datasetId })],
  ] as const)("%s is denied, even with a Manage team grant", async (action, resource) => {
    for (const userId of [ids.viewer, ids.manageViewer]) {
      // The resource factory and the action are paired by the table above.
      await expect(can({ type: "user", id: userId }, action, resource() as never)).resolves.toBe(false);
    }
    // Control: the read & write member is allowed every read, so a refusal above is the role's.
    const isReadAction = !["write", "manage", "share"].some((level) => action.endsWith(level));
    if (isReadAction && !action.startsWith("organization")) {
      await expect(
        can({ type: "user", id: fixture.users.editor }, action, resource() as never)
      ).resolves.toBe(true);
    }
  });
});

describe("SpiceDB grants a Dashboard viewer the dashboard reads of its teams' workspaces", () => {
  const dashboardRead = (userId: string, workspaceId: string) =>
    can({ type: "user", id: userId }, "workspace.dashboard_read", { type: "workspace", id: workspaceId });

  test("workspace.dashboard_read only on a workspace one of their teams is granted, at any level", async () => {
    await expect(dashboardRead(ids.viewer, fixture.workspaceId)).resolves.toBe(true);
    await expect(dashboardRead(ids.manageViewer, fixture.workspaceId)).resolves.toBe(true);
    await expect(dashboardRead(ids.viewer, fixture.otherWorkspaceId)).resolves.toBe(false);
    await expect(dashboardRead(ids.viewer, fixture.foreignWorkspaceId)).resolves.toBe(false);
    await expect(dashboardRead(ids.ungrantedViewer, fixture.workspaceId)).resolves.toBe(false);
    await expect(dashboardRead(ids.foreignViewer, fixture.workspaceId)).resolves.toBe(false);
  });

  test("dashboard.read stays the workspace read: a viewer reads dashboards only through dashboard_read", async () => {
    const read = (userId: string, dashboardId: string) =>
      can({ type: "user", id: userId }, "dashboard.read", { type: "dashboard", id: dashboardId });
    await expect(read(ids.viewer, ids.dashboard)).resolves.toBe(false);
    await expect(read(ids.manageViewer, ids.dashboard)).resolves.toBe(false);
    await expect(read(fixture.users.viewer, ids.dashboard)).resolves.toBe(true);
  });

  test("members keep their dashboard reads, and a member without a grant still has none", async () => {
    await expect(dashboardRead(fixture.users.viewer, fixture.workspaceId)).resolves.toBe(true);
    await expect(dashboardRead(fixture.users.owner, fixture.otherWorkspaceId)).resolves.toBe(true);
    await expect(dashboardRead(fixture.users.viewer, fixture.otherWorkspaceId)).resolves.toBe(false);
  });

  test("the dashboard-bound dataset read only for a dataset assigned to the granted workspace", async () => {
    const read = (datasetId: string, workspaceId = fixture.workspaceId) =>
      can({ type: "user", id: ids.viewer }, "feedbackDirectoryAssignment.dashboard_read", {
        type: "feedbackDirectoryAssignment",
        feedbackDirectoryId: datasetId,
        workspaceId,
      });

    await expect(read(fixture.datasetId)).resolves.toBe(true);
    await expect(read(fixture.unassignedDatasetId)).resolves.toBe(false);
    await expect(read(fixture.foreignDatasetId)).resolves.toBe(false);
    await expect(read(fixture.datasetId, fixture.otherWorkspaceId)).resolves.toBe(false);
  });

  test("lists the viewer's granted workspaces, and none for a viewer with no grant", async () => {
    const granted = await listDashboardViewerWorkspaces(ids.viewer, fixture.organizationId);
    expect(granted.map(({ id }) => id).sort()).toEqual(
      [fixture.workspaceId, ids.emptyDashboardWorkspace].sort()
    );
    await expect(listDashboardViewerWorkspaces(ids.ungrantedViewer, fixture.organizationId)).resolves.toEqual(
      []
    );
    await expect(
      listDashboardViewerWorkspaces(fixture.users.viewer, fixture.organizationId)
    ).resolves.toEqual([]);
  });

  test("the Feedback Dataset gate admits a viewer only when the operation opts in", async () => {
    const access = await requireDashboardsAccess(
      sessionOf(ids.viewer),
      fixture.workspaceId,
      "read",
      "req",
      "/i",
      { allowDashboardViewer: true }
    );
    if (access instanceof Response) throw new Error(`viewer refused the workspace: ${access.status}`);
    expect(access.asDashboardViewer).toBe(true);
    const refuse = (options?: { allowDashboardViewer: boolean }) =>
      refuseUnlessFeedbackDatasetAccess(
        sessionOf(ids.viewer),
        access,
        fixture.datasetId,
        "read",
        "req",
        "/i",
        options
      );

    await expect(refuse({ allowDashboardViewer: true })).resolves.toBeNull();
    expect((await refuse())?.status).toBe(403);
  });
});

describe("dashboard-bound reads: allowed on a granted workspace, refused elsewhere", () => {
  const list = (userId: string, workspaceId: string) =>
    listV3Dashboards({
      query: ZV3DashboardListQuery.parse({ workspaceId }),
      ...ctx(userId, "/api/v3/dashboards"),
    });

  test("lists and reads the granted workspace's dashboards", async () => {
    const listed = await list(ids.viewer, fixture.workspaceId);
    expect(listed.status).toBe(200);
    const { data } = (await listed.json()) as { data: Array<{ id: string }> };
    expect(data.map(({ id }) => id)).toEqual([ids.dashboard]);

    expect(await statusOf(await getV3Dashboard({ dashboardId: ids.dashboard, ...ctx(ids.viewer) }))).toBe(
      200
    );
    expect(
      await statusOf(
        await getV3DashboardWidget({ dashboardId: ids.dashboard, widgetId: ids.widget, ...ctx(ids.viewer) })
      )
    ).toBe(200);
  });

  test("a Manage team grant reads, and widens nothing", async () => {
    expect(
      await statusOf(await getV3Dashboard({ dashboardId: ids.dashboard, ...ctx(ids.manageViewer) }))
    ).toBe(200);
    expect(
      await statusOf(
        await renameV3Dashboard({
          dashboardId: ids.dashboard,
          body: { name: "Renamed" },
          ...ctx(ids.manageViewer),
        } as never)
      )
    ).toBe(403);
  });

  test("a granted workspace with no dashboards lists none", async () => {
    const listed = await list(ids.viewer, ids.emptyDashboardWorkspace);
    expect(listed.status).toBe(200);
    expect(((await listed.json()) as { data: unknown[] }).data).toEqual([]);
  });

  test("refuses a workspace the viewer's teams are not granted, and another organization's", async () => {
    expect(await statusOf(await list(ids.viewer, fixture.otherWorkspaceId))).toBe(403);
    expect(await statusOf(await list(ids.viewer, fixture.foreignWorkspaceId))).toBe(403);
    expect(
      await statusOf(await getV3Dashboard({ dashboardId: ids.hiddenDashboard, ...ctx(ids.viewer) }))
    ).toBe(403);
    expect(await statusOf(await list(ids.foreignViewer, fixture.workspaceId))).toBe(403);
  });

  test("a viewer with no granted workspace sees nothing", async () => {
    expect(await statusOf(await list(ids.ungrantedViewer, fixture.workspaceId))).toBe(403);
  });

  const chartData = (userId: string) =>
    getV3DashboardChartData({
      dashboardId: ids.dashboard,
      chartId: ids.chart,
      query: ZV3DashboardChartDataQuery.parse({}),
      ...ctx(userId, "/api/v3/dashboards/charts/data"),
    });
  const filterValues = (userId: string) =>
    listV3DashboardFilterValues({
      dashboardId: ids.dashboard,
      filterId: FILTER_ID,
      query: ZV3DashboardFilterValuesQuery.parse({}),
      ...ctx(userId, "/api/v3/dashboards/filters/values"),
    });

  test("reads a widget's chart data and a dashboard filter's values through the dashboard", async () => {
    for (const userId of [ids.viewer, ids.manageViewer]) {
      const data = await chartData(userId);
      expect(data.status, await data.clone().text()).toBe(200);
      expect(((await data.json()) as { data: { rows: unknown[] } }).data.rows).toEqual(expect.any(Array));

      const values = await filterValues(userId);
      expect(values.status, await values.clone().text()).toBe(200);
    }
  });

  test("refuses the dashboard-bound data to a viewer without the grant, or on a lapsed plan", async () => {
    expect(await statusOf(await chartData(ids.ungrantedViewer))).toBe(403);
    expect(await statusOf(await filterValues(ids.foreignViewer))).toBe(403);

    // An allowed read decision is kept for 30 seconds, so a lapsed plan stops the viewer once it expires.
    expect(await statusOf(await chartData(ids.viewer))).toBe(200);
    entitlement.viewerRole = false;
    expect(await statusOf(await chartData(ids.viewer))).toBe(200);
    await expireReadDecisions();
    expect(await statusOf(await chartData(ids.viewer))).toBe(403);
    expect(await statusOf(await filterValues(ids.viewer))).toBe(403);
  });

  test("the operation-level gate keeps the viewer out of writes even when asked to admit them", async () => {
    const access = await requireDashboardsAccess(
      sessionOf(ids.viewer),
      fixture.workspaceId,
      "readWrite",
      "req",
      "/i",
      { allowDashboardViewer: true }
    );
    expect((access as Response).status).toBe(403);
  });
});

describe("a feedback records gateway token minted for a viewer", () => {
  // The token routes mint for any signed-in user; what a token may do is decided per request by the
  // gateway, which asks SpiceDB for `feedback_directory#read` (or org manage for a mutation). Hub itself
  // never sees the token: it accepts only the gateway's own API key.
  const listRecords = (userId: string) => {
    const url = new URL(`http://localhost/api/v3/feedbackRecords?tenant_id=${fixture.datasetId}`);
    return feedbackRecordsGatewayAuthorizer.authorize({
      request: new NextRequest(url),
      originalRequest: { method: "GET", url },
      principal: { type: "user", userId, source: "jwt" },
      requestId: "req",
    });
  };

  test("reads no records, while a member holding the same grant does", async () => {
    for (const userId of [ids.viewer, ids.manageViewer]) {
      const decision = await listRecords(userId);
      expect(decision.status).toBe("deny");
      expect(decision.status === "deny" && decision.response.status).toBe(403);
    }
    expect((await listRecords(fixture.users.viewer)).status).toBe("allow");
  });
});

/** What 30 seconds do to the kept dashboard read decisions (`withCachedDashboardDecision`). */
async function expireReadDecisions(): Promise<void> {
  await cache.runRedisOperation(async (redis) => {
    for await (const keys of redis.scanIterator({ MATCH: "*read-decision*", COUNT: 1000 })) {
      const batch = ([] as string[]).concat(keys);
      if (batch.length > 0) await redis.del(batch);
    }
  });
}

describe("everything else refuses a viewer", () => {
  test.each([
    [
      "POST /dashboards",
      () =>
        createV3Dashboard({
          body: { workspaceId: fixture.workspaceId, name: "New" },
          ...ctx(ids.viewer),
        } as never),
    ],
    [
      "PATCH /dashboards/{id}",
      () =>
        renameV3Dashboard({ dashboardId: ids.dashboard, body: { name: "X" }, ...ctx(ids.viewer) } as never),
    ],
    [
      "POST /dashboards/{id}/duplicate",
      () => duplicateV3Dashboard({ dashboardId: ids.dashboard, body: {}, ...ctx(ids.viewer) } as never),
    ],
    [
      "DELETE /dashboards/{id}",
      () => deleteV3Dashboard({ dashboardId: ids.dashboard, ...ctx(ids.viewer) } as never),
    ],
    [
      "GET /charts",
      () =>
        listV3Charts({
          query: ZV3ChartListQuery.parse({ workspaceId: fixture.workspaceId }),
          ...ctx(ids.viewer),
        }),
    ],
    ["GET /charts/{id}", () => getV3Chart({ chartId: ids.chart, ...ctx(ids.viewer) })],
    [
      "POST /charts",
      () =>
        createV3Chart({
          body: {
            workspaceId: fixture.workspaceId,
            datasetId: fixture.datasetId,
            name: "C",
            type: "bar",
            query: { measures: ["FeedbackRecords.count"] },
          },
          ...ctx(ids.viewer),
        } as never),
    ],
    [
      "POST /charts/preview",
      () =>
        previewV3Chart({
          body: ZV3ChartPreviewBody.parse({
            workspaceId: fixture.workspaceId,
            datasetId: fixture.datasetId,
            type: "bar",
            query: { measures: ["FeedbackRecords.count"] },
          }),
          ...ctx(ids.viewer),
        }),
    ],
    [
      "GET /charts/{id}/data",
      () => getV3ChartData({ chartId: ids.chart, query: ZV3ChartDataQuery.parse({}), ...ctx(ids.viewer) }),
    ],
    [
      "GET /charts/fields/{field}/values",
      () =>
        listV3ChartFieldValues({
          field: "sourceName",
          query: ZV3ChartFieldValuesQuery.parse({
            workspaceId: fixture.workspaceId,
            datasetId: fixture.datasetId,
          }),
          ...ctx(ids.viewer),
        }),
    ],
    [
      "GET /surveys",
      () =>
        listV3Surveys({
          searchParams: new URLSearchParams({ workspaceId: fixture.workspaceId }),
          ...ctx(ids.viewer),
        }),
    ],
    ["GET /surveys/{id}", () => getV3Survey({ surveyId: ids.survey, ...ctx(ids.viewer) })],
    [
      "GET /responses",
      () =>
        listV3Responses({
          searchParams: new URLSearchParams({ workspaceId: fixture.workspaceId }),
          ...ctx(ids.viewer),
        }),
    ],
    ["GET /responses/{id}", () => getV3Response({ responseId: ids.response, ...ctx(ids.viewer) })],
    [
      "GET /contacts",
      () =>
        listV3Contacts({
          searchParams: new URLSearchParams({ workspaceId: fixture.workspaceId }),
          ...ctx(ids.viewer),
        }),
    ],
    [
      "GET /feedback datasets",
      () => listV3FeedbackDatasets({ workspaceId: fixture.workspaceId, ...ctx(ids.viewer) }),
    ],
    [
      "GET /feedbackRecords",
      () =>
        listV3FeedbackRecords({
          workspaceId: fixture.workspaceId,
          datasetId: fixture.datasetId,
          ...ctx(ids.viewer),
        } as never),
    ],
    [
      "GET /feedbackRecords/{id}",
      () =>
        getV3FeedbackRecord({
          workspaceId: fixture.workspaceId,
          datasetId: fixture.datasetId,
          feedbackRecordId: "00000000-0000-4000-8000-000000000000",
          ...ctx(ids.viewer),
        } as never),
    ],
  ] as const)("%s answers 403", async (_operation, call) => {
    expect(await statusOf(await call())).toBe(403);
  });
});

describe("the free-form chart routes answer a viewer exactly as a member without access", () => {
  test.each([
    [
      "POST /charts/preview",
      (userId: string) =>
        previewV3Chart({
          body: ZV3ChartPreviewBody.parse({
            workspaceId: fixture.workspaceId,
            datasetId: fixture.datasetId,
            type: "bar",
            query: { measures: ["FeedbackRecords.count"] },
          }),
          ...ctx(userId, "/api/v3/charts/preview"),
        }),
    ],
    [
      "GET /charts/fields/{field}/values",
      (userId: string) =>
        listV3ChartFieldValues({
          field: "sourceName",
          query: ZV3ChartFieldValuesQuery.parse({
            workspaceId: fixture.workspaceId,
            datasetId: fixture.datasetId,
          }),
          ...ctx(userId, "/api/v3/charts/fields/values"),
        }),
    ],
    [
      "GET /charts/{id}/data",
      (userId: string) =>
        getV3ChartData({
          chartId: ids.chart,
          query: ZV3ChartDataQuery.parse({}),
          ...ctx(userId, "/api/v3/charts/data"),
        }),
    ],
  ] as const)("%s", async (_route, call) => {
    const asViewer = await call(ids.viewer);
    const asOutsider = await call(fixture.users.outsider);
    const strip = (body: Record<string, unknown>) => ({ ...body, requestId: undefined });

    expect(asViewer.status).toBe(403);
    expect(strip(await asViewer.json())).toEqual(strip(await asOutsider.json()));
  });
});

describe("role changes are projected at once", () => {
  test("a Member made a viewer trades the member relation for dashboard_viewer, and loses every raw read", async () => {
    await expect(
      can({ type: "user", id: ids.demoted }, "workspace.read", { type: "workspace", id: fixture.workspaceId })
    ).resolves.toBe(true);

    await updateMembership(ids.demoted, fixture.organizationId, { role: "dashboard_viewer" });

    await expect(
      can({ type: "user", id: ids.demoted }, "organization.read", {
        type: "organization",
        id: fixture.organizationId,
      })
    ).resolves.toBe(false);
    await expect(
      can({ type: "user", id: ids.demoted }, "workspace.read", { type: "workspace", id: fixture.workspaceId })
    ).resolves.toBe(false);
    await expect(
      can({ type: "user", id: ids.demoted }, "workspace.dashboard_read", {
        type: "workspace",
        id: fixture.workspaceId,
      })
    ).resolves.toBe(true);
    expect(await statusOf(await getV3Survey({ surveyId: ids.survey, ...ctx(ids.demoted) }))).toBe(403);
    expect(await statusOf(await getV3Dashboard({ dashboardId: ids.dashboard, ...ctx(ids.demoted) }))).toBe(
      200
    );
  });

  test("a viewer changed back to Member gets the member relation back", async () => {
    await updateMembership(ids.promoted, fixture.organizationId, { role: "member" });

    await expect(
      can({ type: "user", id: ids.promoted }, "workspace.read", {
        type: "workspace",
        id: fixture.workspaceId,
      })
    ).resolves.toBe(true);
    await expect(getDashboardViewerWorkspaceState(ids.promoted, fixture.workspaceId)).resolves.toBe("none");
  });
});

describe("what the pages decide for a viewer (ENG-6902)", () => {
  test("a granted workspace is granted; a lapsed plan is lapsed, not none; anything else is none", async () => {
    await expect(getDashboardViewerWorkspaceState(ids.viewer, fixture.workspaceId)).resolves.toBe("granted");
    await expect(getDashboardViewerWorkspaceState(ids.viewer, fixture.otherWorkspaceId)).resolves.toBe(
      "none"
    );
    await expect(getDashboardViewerWorkspaceState(fixture.users.viewer, fixture.workspaceId)).resolves.toBe(
      "none"
    );

    entitlement.viewerRole = false;
    await expect(getDashboardViewerWorkspaceState(ids.viewer, fixture.workspaceId)).resolves.toBe("lapsed");
  });

  test("lands on the last-used granted workspace, else the first, else the unavailable page", async () => {
    await expect(
      getDashboardViewerHomePath(ids.viewer, fixture.organizationId, ids.emptyDashboardWorkspace)
    ).resolves.toBe(`/workspaces/${ids.emptyDashboardWorkspace}/dashboards`);
    // A remembered workspace the viewer may not read is ignored.
    const fallback = await getDashboardViewerHomePath(
      ids.viewer,
      fixture.organizationId,
      fixture.otherWorkspaceId
    );
    expect([
      `/workspaces/${fixture.workspaceId}/dashboards`,
      `/workspaces/${ids.emptyDashboardWorkspace}/dashboards`,
    ]).toContain(fallback);
    await expect(getDashboardViewerHomePath(ids.ungrantedViewer, fixture.organizationId)).resolves.toBe(
      `/organizations/${fixture.organizationId}/dashboards-unavailable`
    );

    entitlement.viewerRole = false;
    await expect(getDashboardViewerHomePath(ids.viewer, fixture.organizationId)).resolves.toBe(
      `/organizations/${fixture.organizationId}/dashboards-unavailable`
    );
  });

  test("lists the organizations a user is a viewer of, entitled or not", async () => {
    entitlement.viewerRole = false;
    const organizations = await listDashboardViewerOrganizations(ids.viewer);
    expect(organizations.map(({ id }) => id)).toEqual([fixture.organizationId]);
    await expect(listDashboardViewerOrganizations(fixture.users.owner)).resolves.toEqual([]);
  });

  test("a viewer is never a workflow email recipient for the workspace", async () => {
    const recipients = await getWorkspaceMembers(fixture.workspaceId);
    const emails = recipients.map(({ email }) => email);

    expect(emails).toContain("viewer@dashboards.test");
    expect(emails).not.toContain("viewer@viewer.test");
    expect(emails).not.toContain("manage-viewer@viewer.test");
  });
});

describe("entitlement lapse", () => {
  test("Access Control lapsing locks the viewer out without changing the role", async () => {
    entitlement.viewerRole = false;

    expect(await statusOf(await getV3Dashboard({ dashboardId: ids.dashboard, ...ctx(ids.viewer) }))).toBe(
      403
    );
    await expect(listDashboardViewerWorkspaces(ids.viewer, fixture.organizationId)).resolves.toEqual([]);
    const membership = await prisma.membership.findUniqueOrThrow({
      where: { userId_organizationId: { userId: ids.viewer, organizationId: fixture.organizationId } },
    });
    expect(membership.role).toBe("dashboard_viewer");
  });

  test("Dashboards lapsing locks the viewer out too", async () => {
    entitlement.dashboards = false;

    expect(await statusOf(await getV3Dashboard({ dashboardId: ids.dashboard, ...ctx(ids.viewer) }))).toBe(
      403
    );
  });
});
