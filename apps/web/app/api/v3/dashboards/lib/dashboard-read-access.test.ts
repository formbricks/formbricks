import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TDashboardsAccessContext } from "@/app/api/v3/lib/dashboards-access";
import {
  canReadDashboard,
  filterReadableDashboardIdsInWorkspace,
  filterReadablePageIds,
} from "@/modules/ee/dashboard-access/lib/spicedb-access";
import {
  createViewerDashboardListScope,
  getReadablePageIds,
  getReadablePageIdsCached,
  limitEmbeddedChartDashboards,
  refuseUnlessDashboardOpenable,
} from "./dashboard-read-access";
import { withCachedDashboardDecision } from "./read-decision-cache";
import { listDashboardPageScopeRows } from "./service";

vi.mock("server-only", () => ({}));
vi.mock("@/modules/ee/dashboard-access/lib/spicedb-access", () => ({
  canReadDashboard: vi.fn(),
  filterReadableDashboardIdsInWorkspace: vi.fn(),
  filterReadablePageIds: vi.fn(),
}));
vi.mock("./service", () => ({ listDashboardPageScopeRows: vi.fn() }));
vi.mock("./read-decision-cache", () => ({
  getDashboardReadPrincipal: vi.fn(() => "principal"),
  withCachedDashboardDecision: vi.fn(),
}));

const member: TDashboardsAccessContext = {
  workspaceId: "ws_1",
  organizationId: "org_1",
  environmentId: "env_1",
} as TDashboardsAccessContext;
const viewer: TDashboardsAccessContext = { ...member, asDashboardViewer: true, readerUserId: "user_1" };
const viewerWithoutSubject: TDashboardsAccessContext = { ...member, asDashboardViewer: true };
const context = { authentication: null, requestId: "req_1", instance: "/api/v3/x" };
const dashboard = { id: "d1", updatedAt: new Date("2026-11-01T00:00:00.000Z") };

beforeEach(() => {
  vi.mocked(withCachedDashboardDecision).mockImplementation((_key, decide) => decide());
});

describe("refuseUnlessDashboardOpenable", () => {
  test("asks nothing of a caller who is not a Dashboard Viewer", async () => {
    expect(await refuseUnlessDashboardOpenable(member, "d1", context)).toBeNull();
    expect(canReadDashboard).not.toHaveBeenCalled();
  });

  test("lets a viewer through when SpiceDB allows the dashboard", async () => {
    vi.mocked(canReadDashboard).mockResolvedValue(true);
    expect(await refuseUnlessDashboardOpenable(viewer, "d1", context)).toBeNull();
    expect(canReadDashboard).toHaveBeenCalledWith({ type: "user", id: "user_1" }, "d1");
  });

  test("answers 403 when SpiceDB refuses, or there is no subject to ask for", async () => {
    vi.mocked(canReadDashboard).mockResolvedValue(false);
    expect((await refuseUnlessDashboardOpenable(viewer, "d1", context))?.status).toBe(403);
    expect((await refuseUnlessDashboardOpenable(viewerWithoutSubject, "d1", context))?.status).toBe(403);
  });
});

describe("getReadablePageIds", () => {
  test("reaches every page for a non-viewer", async () => {
    expect(await getReadablePageIds(member, ["p1", "p2"], null)).toEqual(new Set(["p1", "p2"]));
    expect(filterReadablePageIds).not.toHaveBeenCalled();
  });

  test("asks SpiceDB for a viewer, and reaches none without a subject", async () => {
    vi.mocked(filterReadablePageIds).mockResolvedValue(new Set(["p1"]));
    expect(await getReadablePageIds(viewer, ["p1", "p2"], null)).toEqual(new Set(["p1"]));
    expect(await getReadablePageIds(viewerWithoutSubject, ["p1"], null)).toEqual(new Set());
  });
});

describe("getReadablePageIdsCached", () => {
  test("reaches every distinct page for a non-viewer", async () => {
    expect(await getReadablePageIdsCached(member, dashboard, ["p1", "p1", "p2"], context)).toEqual(
      new Set(["p1", "p2"])
    );
  });

  test("reaches none for a viewer without a subject", async () => {
    expect(await getReadablePageIdsCached(viewerWithoutSubject, dashboard, ["p1"], context)).toEqual(
      new Set()
    );
  });

  test("keeps each page's allow on its own, so a later read reuses allows and decides denied pages again", async () => {
    // A cache that keeps allows only, as the real one does for the read-decision TTL: a denial is a
    // Response and is never kept.
    const cache = new Map<string, unknown>();
    vi.mocked(withCachedDashboardDecision).mockImplementation(async ({ decision }, decide) => {
      if (cache.has(decision)) return cache.get(decision) as Awaited<ReturnType<typeof decide>>;
      const decided = await decide();
      if (!(decided instanceof Response)) cache.set(decision, decided);
      return decided;
    });
    vi.mocked(filterReadablePageIds).mockImplementation(
      async (_subject, pageIds) => new Set(pageIds.filter((pageId) => pageId === "p1"))
    );

    expect(await getReadablePageIdsCached(viewer, dashboard, ["p1", "p2", "p1"], context)).toEqual(
      new Set(["p1"])
    );

    // SpiceDB now allows every page except p1: p1's kept allow is reused, p2's denial is decided again.
    vi.mocked(filterReadablePageIds).mockImplementation(
      async (_subject, pageIds) => new Set(pageIds.filter((pageId) => pageId !== "p1"))
    );
    expect(await getReadablePageIdsCached(viewer, dashboard, ["p1", "p2", "p3"], context)).toEqual(
      new Set(["p1", "p2", "p3"])
    );
  });
});

describe("createViewerDashboardListScope", () => {
  const subject = { type: "user" as const, id: "user_1" };
  const page = (id: string, dashboardId: string, widgets: number, holdsChart = false) => ({
    id,
    dashboardId,
    _count: { widgets },
    widgets: holdsChart ? [{ id: `w-${id}` }] : [],
  });

  test("keeps dashboards with an open page and counts only the open pages' widgets", async () => {
    vi.mocked(filterReadableDashboardIdsInWorkspace).mockResolvedValue(new Set(["d1", "d2"]));
    vi.mocked(listDashboardPageScopeRows).mockResolvedValue([
      page("p1", "d1", 2),
      page("p2", "d1", 5),
      page("p3", "d2", 4),
    ]);
    vi.mocked(filterReadablePageIds).mockResolvedValue(new Set(["p1"]));
    const scope = createViewerDashboardListScope(subject, "ws_1");

    // d2's only page is limited to another team: like a read of it, the list leaves it out.
    expect(await scope.readable(["d1", "d2", "d3"])).toEqual(new Set(["d1"]));
    expect(filterReadableDashboardIdsInWorkspace).toHaveBeenCalledWith(subject, "ws_1", ["d1", "d2", "d3"]);
    expect(listDashboardPageScopeRows).toHaveBeenCalledWith(["d1", "d2"], undefined);
    expect(scope.widgetCount("d1")).toBe(2);
  });

  test("with a chart filter, keeps only dashboards holding the chart on a page the reader can open", async () => {
    vi.mocked(filterReadableDashboardIdsInWorkspace).mockResolvedValue(new Set(["d1", "d2"]));
    vi.mocked(listDashboardPageScopeRows).mockResolvedValue([
      page("p1", "d1", 1),
      page("p2", "d1", 1, true),
      page("p3", "d2", 1, true),
    ]);
    vi.mocked(filterReadablePageIds).mockResolvedValue(new Set(["p1", "p3"]));
    const scope = createViewerDashboardListScope(subject, "ws_1", "chart_1");

    expect(await scope.readable(["d1", "d2"])).toEqual(new Set(["d2"]));
    expect(listDashboardPageScopeRows).toHaveBeenCalledWith(["d1", "d2"], "chart_1");
  });

  test("reads no pages when no dashboard of the batch is readable", async () => {
    vi.mocked(filterReadableDashboardIdsInWorkspace).mockResolvedValue(new Set());
    const scope = createViewerDashboardListScope(subject, "ws_1");

    expect(await scope.readable(["d1"])).toEqual(new Set());
    expect(listDashboardPageScopeRows).not.toHaveBeenCalled();
    expect(scope.widgetCount("d1")).toBe(0);
  });
});

describe("limitEmbeddedChartDashboards", () => {
  const widgets = [
    { id: "w1", chart: { widgets: [{ dashboard: { id: "d1" } }, { dashboard: { id: "d2" } }] } },
    { id: "w2", chart: null },
  ];

  test("leaves every dashboard for a reader who is not a Dashboard Viewer", async () => {
    expect(await limitEmbeddedChartDashboards(member, widgets, null)).toBe(widgets);
    expect(filterReadableDashboardIdsInWorkspace).not.toHaveBeenCalled();
  });

  test("names only the dashboards a viewer can open", async () => {
    vi.mocked(filterReadableDashboardIdsInWorkspace).mockResolvedValue(new Set(["d1"]));
    vi.mocked(listDashboardPageScopeRows).mockResolvedValue([
      { id: "p1", dashboardId: "d1", _count: { widgets: 1 }, widgets: [] },
    ]);
    vi.mocked(filterReadablePageIds).mockResolvedValue(new Set(["p1"]));

    expect(await limitEmbeddedChartDashboards(viewer, widgets, null)).toEqual([
      { id: "w1", chart: { widgets: [{ dashboard: { id: "d1" } }] } },
      { id: "w2", chart: null },
    ]);
    expect(filterReadableDashboardIdsInWorkspace).toHaveBeenCalledWith(
      { type: "user", id: "user_1" },
      "ws_1",
      ["d1", "d2"]
    );
  });

  test("does not name a readable dashboard whose pages are all limited away from the viewer", async () => {
    // d2 passes `dashboard.read`, but its only page is limited to another team: a read of it answers 403
    // and the list leaves it out, so a chart must not name it either.
    vi.mocked(filterReadableDashboardIdsInWorkspace).mockResolvedValue(new Set(["d1", "d2"]));
    vi.mocked(listDashboardPageScopeRows).mockResolvedValue([
      { id: "p1", dashboardId: "d1", _count: { widgets: 1 }, widgets: [] },
      { id: "p2", dashboardId: "d2", _count: { widgets: 1 }, widgets: [] },
    ]);
    vi.mocked(filterReadablePageIds).mockResolvedValue(new Set(["p1"]));

    expect(await limitEmbeddedChartDashboards(viewer, widgets, null)).toEqual([
      { id: "w1", chart: { widgets: [{ dashboard: { id: "d1" } }] } },
      { id: "w2", chart: null },
    ]);
    // One batched page read and one batched page check for every dashboard named, never one per dashboard.
    expect(listDashboardPageScopeRows).toHaveBeenCalledTimes(1);
    expect(listDashboardPageScopeRows).toHaveBeenCalledWith(["d1", "d2"], undefined);
    expect(filterReadablePageIds).toHaveBeenCalledTimes(1);
    expect(filterReadablePageIds).toHaveBeenCalledWith({ type: "user", id: "user_1" }, ["p1", "p2"]);
  });

  test("names none for a viewer without a subject", async () => {
    expect(await limitEmbeddedChartDashboards(viewerWithoutSubject, widgets, null)).toEqual([
      { id: "w1", chart: { widgets: [] } },
      { id: "w2", chart: null },
    ]);
  });
});
