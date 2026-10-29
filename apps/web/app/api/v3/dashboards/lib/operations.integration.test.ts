import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getV3Chart } from "@/app/api/v3/charts/lib/operations";
import {
  type TDashboardsFixture,
  apiKeyOf,
  outcomeOf,
  seedDashboardsFixture,
  sessionOf,
} from "@/integration/dashboards-fixture";
import {
  createV3Dashboard,
  deleteV3Dashboard,
  duplicateV3Dashboard,
  getV3Dashboard,
  listV3Dashboards,
  renameV3Dashboard,
} from "./operations";
import {
  type TV3DashboardListItem,
  type TV3DashboardResource,
  ZV3DashboardListItem,
  ZV3DashboardResource,
} from "./resources";
import { ZV3DashboardListQuery } from "./schemas";

/**
 * Dashboard operations against real PostgreSQL and SpiceDB, called the way the route and the MCP tools
 * call them. ENG-6591: listing and reading. ENG-6592: create, rename, duplicate, delete.
 */

const entitlement = vi.hoisted(() => ({ dashboards: true }));
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardsEnabled: vi.fn(async () => entitlement.dashboards),
}));

let fixture: TDashboardsFixture;
const ids = { older: "", newer: "", empty: "", shared: "", solo: "", widgetShared: "", widgetSolo: "" };

const context = (authentication: ReturnType<typeof sessionOf>) => ({
  authentication,
  requestId: "req",
  instance: "/api/v3/dashboards",
});

const list = (authentication: ReturnType<typeof sessionOf>, query: Record<string, unknown> = {}) =>
  listV3Dashboards({
    query: ZV3DashboardListQuery.parse({ workspaceId: fixture.workspaceId, ...query }),
    ...context(authentication),
  });

const bodyOf = async <T>(response: Response) => (await response.json()) as T;

beforeAll(async () => {
  fixture = await seedDashboardsFixture();

  const chart = (name: string) =>
    prisma.chart.create({
      data: {
        name,
        type: "bar",
        workspaceId: fixture.workspaceId,
        feedbackDirectoryId: fixture.datasetId,
        query: { measures: ["FeedbackRecords.count"] },
        config: {},
      },
    });
  ids.shared = (await chart("Shared chart")).id;
  ids.solo = (await chart("Solo chart")).id;

  const dashboard = (name: string, createdAt: string) =>
    prisma.dashboard.create({
      data: {
        name,
        workspaceId: fixture.workspaceId,
        createdAt: new Date(createdAt),
        createdBy: fixture.users.editor,
      },
    });
  ids.older = (await dashboard("Event 2025", "2026-01-01T00:00:00Z")).id;
  ids.newer = (await dashboard("Event 2026", "2026-02-01T00:00:00Z")).id;
  ids.empty = (await dashboard("Scratch", "2026-03-01T00:00:00Z")).id;

  ids.widgetSolo = (
    await prisma.dashboardWidget.create({
      data: { dashboardId: ids.newer, chartId: ids.solo, layout: { x: 6, y: 0, w: 6, h: 4 }, order: 1 },
    })
  ).id;
  ids.widgetShared = (
    await prisma.dashboardWidget.create({
      data: { dashboardId: ids.newer, chartId: ids.shared, layout: { x: 0, y: 0, w: 6, h: 4 }, order: 0 },
    })
  ).id;
  await prisma.dashboardWidget.create({
    data: { dashboardId: ids.older, chartId: ids.shared, layout: { x: 0, y: 0, w: 4, h: 4 }, order: 0 },
  });
}, 120_000);

beforeEach(() => {
  entitlement.dashboards = true;
});

describe("GET /api/v3/dashboards", () => {
  test("lists dashboards newest first with a widget count instead of the widgets", async () => {
    const response = await list(apiKeyOf(fixture, "readKey"));
    expect(response.status).toBe(200);

    const { data } = await bodyOf<{ data: TV3DashboardListItem[] }>(response);
    for (const item of data) ZV3DashboardListItem.parse(item);
    expect(data.map(({ name, widgetCount }) => ({ name, widgetCount }))).toEqual([
      { name: "Scratch", widgetCount: 0 },
      { name: "Event 2026", widgetCount: 2 },
      { name: "Event 2025", widgetCount: 1 },
    ]);
    expect(data[1].creator).toEqual({ name: "editor" });
  });

  test("pages with a cursor until nextCursor is null", async () => {
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const body = await bodyOf<{ data: TV3DashboardListItem[]; meta: { nextCursor: string | null } }>(
        await list(sessionOf(fixture.users.viewer), { limit: "2", ...(cursor ? { cursor } : {}) })
      );
      seen.push(...body.data.map((dashboard) => dashboard.id));
      cursor = body.meta.nextCursor ?? undefined;
    } while (cursor);

    expect(seen).toEqual([ids.empty, ids.newer, ids.older]);
  });

  test("filter[chartId][eq] lists exactly the dashboards that hold the chart — what the chart embeds", async () => {
    const { data } = await bodyOf<{ data: TV3DashboardListItem[] }>(
      await list(sessionOf(fixture.users.viewer), { "filter[chartId][eq]": ids.shared })
    );
    expect(data.map((dashboard) => dashboard.id)).toEqual([ids.newer, ids.older]);

    const chart = await bodyOf<{ data: { dashboards: { id: string }[] } }>(
      await getV3Chart({ chartId: ids.shared, ...context(sessionOf(fixture.users.viewer)) })
    );
    expect(chart.data.dashboards.map((dashboard) => dashboard.id).sort()).toEqual(
      [ids.newer, ids.older].sort()
    );
  });

  test("filters by name", async () => {
    const { data } = await bodyOf<{ data: TV3DashboardListItem[] }>(
      await list(sessionOf(fixture.users.viewer), { "filter[name][contains]": "event" })
    );
    expect(data.map((dashboard) => dashboard.name)).toEqual(["Event 2026", "Event 2025"]);
  });

  test("refuses a caller without workspace access, and names the missing plan to one with it", async () => {
    expect(await outcomeOf(await list(sessionOf(fixture.users.outsider)))).toEqual({
      status: 403,
      code: "forbidden",
    });

    entitlement.dashboards = false;
    expect(await outcomeOf(await list(sessionOf(fixture.users.viewer)))).toEqual({
      status: 403,
      code: "dashboards_plan_required",
    });
  });
});

describe("GET /api/v3/dashboards/{dashboardId}", () => {
  test("returns every widget in order, each with exactly the chart a chart read returns", async () => {
    const response = await getV3Dashboard({
      dashboardId: ids.newer,
      ...context(sessionOf(fixture.users.viewer)),
    });
    expect(response.status).toBe(200);

    const { data } = await bodyOf<{ data: TV3DashboardResource }>(response);
    expect(
      ZV3DashboardResource.parse(data).widgets.map(({ id, chartId, layout, order }) => ({
        id,
        chartId,
        layout,
        order,
      }))
    ).toEqual([
      { id: ids.widgetShared, chartId: ids.shared, layout: { x: 0, y: 0, w: 6, h: 4 }, order: 0 },
      { id: ids.widgetSolo, chartId: ids.solo, layout: { x: 6, y: 0, w: 6, h: 4 }, order: 1 },
    ]);

    const chartRead = await bodyOf<{ data: unknown }>(
      await getV3Chart({ chartId: ids.shared, ...context(sessionOf(fixture.users.viewer)) })
    );
    expect(data.widgets[0].chart).toEqual(chartRead.data);
  });

  test("answers 403 for a dashboard the caller cannot see and one that does not exist", async () => {
    expect(
      await outcomeOf(
        await getV3Dashboard({ dashboardId: ids.newer, ...context(sessionOf(fixture.users.outsider)) })
      )
    ).toEqual({ status: 403, code: "forbidden" });
    expect(
      await outcomeOf(
        await getV3Dashboard({
          dashboardId: "clzzzzzzzzzzzzzzzzzzzzzzz",
          ...context(sessionOf(fixture.users.owner)),
        })
      )
    ).toEqual({ status: 403, code: "forbidden" });
  });
});

const auditLog = () => ({}) as Record<string, unknown>;

const createDashboard = (
  authentication: ReturnType<typeof sessionOf>,
  name: string,
  log: Record<string, unknown> = auditLog()
) =>
  createV3Dashboard({
    body: { workspaceId: fixture.workspaceId, name },
    auditLog: log as never,
    ...context(authentication),
  });

describe("POST /api/v3/dashboards", () => {
  test("creates an empty dashboard with Location, audited, and refuses a taken name with 409", async () => {
    const log = auditLog();
    const response = await createDashboard(sessionOf(fixture.users.editor), "Created over v3", log);
    expect(response.status).toBe(201);

    const { data } = await bodyOf<{ data: TV3DashboardResource }>(response);
    expect(response.headers.get("Location")).toBe(`/api/v3/dashboards/${data.id}`);
    expect(data).toMatchObject({ name: "Created over v3", widgets: [], creator: { name: "editor" } });
    expect(log).toMatchObject({ targetId: data.id, organizationId: fixture.organizationId });

    expect(await outcomeOf(await createDashboard(apiKeyOf(fixture, "writeKey"), "Created over v3"))).toEqual({
      status: 409,
      code: "conflict",
    });
  });

  test("needs write access to the workspace", async () => {
    expect(await outcomeOf(await createDashboard(sessionOf(fixture.users.viewer), "Viewer's"))).toEqual({
      status: 403,
      code: "forbidden",
    });
    expect(await outcomeOf(await createDashboard(apiKeyOf(fixture, "readKey"), "Read key's"))).toEqual({
      status: 403,
      code: "forbidden",
    });
    expect(await prisma.dashboard.count({ where: { name: { in: ["Viewer's", "Read key's"] } } })).toBe(0);
  });
});

describe("PATCH /api/v3/dashboards/{dashboardId}", () => {
  test("renames and moves updatedAt; a taken name is 409 and a viewer is refused", async () => {
    const { id } = await prisma.dashboard.create({
      data: {
        name: "To rename",
        workspaceId: fixture.workspaceId,
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });

    const response = await renameV3Dashboard({
      dashboardId: id,
      body: { name: "Renamed" },
      auditLog: auditLog() as never,
      ...context(apiKeyOf(fixture, "writeKey")),
    });
    expect(response.status).toBe(200);
    const { data } = await bodyOf<{ data: TV3DashboardResource }>(response);
    expect(data.name).toBe("Renamed");
    expect(new Date(data.updatedAt).getTime()).toBeGreaterThan(new Date("2026-01-01T00:00:00Z").getTime());

    const rename = (authentication: ReturnType<typeof sessionOf>, name: string) =>
      renameV3Dashboard({ dashboardId: id, body: { name }, ...context(authentication) });
    expect(await outcomeOf(await rename(sessionOf(fixture.users.editor), "Event 2026"))).toEqual({
      status: 409,
      code: "conflict",
    });
    expect(await outcomeOf(await rename(sessionOf(fixture.users.viewer), "Viewer's"))).toEqual({
      status: 403,
      code: "forbidden",
    });
  });
});

describe("POST /api/v3/dashboards/{dashboardId}/duplicate", () => {
  test("copies the layout onto the same charts, and names copies after the original", async () => {
    const duplicate = (name?: string) =>
      duplicateV3Dashboard({
        dashboardId: ids.newer,
        body: name === undefined ? {} : { name },
        auditLog: auditLog() as never,
        ...context(sessionOf(fixture.users.editor)),
      });

    const first = await duplicate();
    expect(first.status).toBe(201);
    const copy = (await bodyOf<{ data: TV3DashboardResource }>(first)).data;
    expect(first.headers.get("Location")).toBe(`/api/v3/dashboards/${copy.id}`);
    expect(copy.name).toBe("Event 2026 (copy)");
    expect(copy.widgets.map(({ chartId, layout, order }) => ({ chartId, layout, order }))).toEqual([
      { chartId: ids.shared, layout: { x: 0, y: 0, w: 6, h: 4 }, order: 0 },
      { chartId: ids.solo, layout: { x: 6, y: 0, w: 6, h: 4 }, order: 1 },
    ]);
    expect(await prisma.chart.count({ where: { workspaceId: fixture.workspaceId } })).toBe(2);

    const second = (await bodyOf<{ data: TV3DashboardResource }>(await duplicate())).data;
    expect(second.name).toBe("Event 2026 (copy 2)");

    // Duplicating a copy names it after the original, not "(copy) (copy)".
    const ofCopy = (
      await bodyOf<{ data: TV3DashboardResource }>(
        await duplicateV3Dashboard({
          dashboardId: copy.id,
          body: {},
          ...context(sessionOf(fixture.users.editor)),
        })
      )
    ).data;
    expect(ofCopy.name).toBe("Event 2026 (copy 3)");

    expect(await outcomeOf(await duplicate("Event 2025"))).toEqual({ status: 409, code: "conflict" });

    const named = (await bodyOf<{ data: TV3DashboardResource }>(await duplicate("Event 2026 for sales")))
      .data;
    expect(named.name).toBe("Event 2026 for sales");

    await prisma.dashboard.deleteMany({ where: { id: { in: [copy.id, second.id, ofCopy.id, named.id] } } });
  });

  test("refuses a viewer and a dashboard in another workspace", async () => {
    const foreign = await prisma.dashboard.create({
      data: { name: "Foreign", workspaceId: fixture.foreignWorkspaceId },
    });
    for (const [dashboardId, authentication] of [
      [ids.newer, sessionOf(fixture.users.viewer)],
      [foreign.id, sessionOf(fixture.users.owner)],
    ] as const) {
      expect(
        await outcomeOf(await duplicateV3Dashboard({ dashboardId, body: {}, ...context(authentication) }))
      ).toEqual({ status: 403, code: "forbidden" });
    }
    expect(await prisma.dashboard.count({ where: { name: { startsWith: "Foreign (copy" } } })).toBe(0);
  });
});

describe("DELETE /api/v3/dashboards/{dashboardId}", () => {
  test("deletes the dashboard and its widgets and keeps every chart, even one no other dashboard holds", async () => {
    const chart = await prisma.chart.create({
      data: {
        name: "Only on the doomed dashboard",
        type: "bar",
        workspaceId: fixture.workspaceId,
        feedbackDirectoryId: fixture.datasetId,
        query: { measures: ["FeedbackRecords.count"] },
        config: {},
      },
    });
    const doomed = await prisma.dashboard.create({
      data: {
        name: "Doomed",
        workspaceId: fixture.workspaceId,
        widgets: { create: [{ chartId: chart.id, layout: { x: 0, y: 0, w: 4, h: 4 }, order: 0 }] },
      },
    });

    expect(
      await outcomeOf(
        await deleteV3Dashboard({ dashboardId: doomed.id, ...context(sessionOf(fixture.users.viewer)) })
      )
    ).toEqual({ status: 403, code: "forbidden" });

    const log = auditLog();
    const response = await deleteV3Dashboard({
      dashboardId: doomed.id,
      auditLog: log as never,
      ...context(apiKeyOf(fixture, "writeKey")),
    });
    expect(response.status).toBe(204);
    expect(log).toMatchObject({ targetId: doomed.id, oldObject: { name: "Doomed" } });

    expect(await prisma.dashboard.findUnique({ where: { id: doomed.id } })).toBeNull();
    expect(await prisma.dashboardWidget.count({ where: { dashboardId: doomed.id } })).toBe(0);
    expect(await prisma.chart.findUnique({ where: { id: chart.id } })).not.toBeNull();

    // A second delete finds nothing to authorize: the same 403 as one that never existed.
    expect(
      await outcomeOf(
        await deleteV3Dashboard({ dashboardId: doomed.id, ...context(sessionOf(fixture.users.owner)) })
      )
    ).toEqual({ status: 403, code: "forbidden" });

    await prisma.chart.delete({ where: { id: chart.id } });
  });
});
