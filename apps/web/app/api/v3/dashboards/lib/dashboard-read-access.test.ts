import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TDashboardsAccessContext } from "@/app/api/v3/lib/dashboards-access";
import { canReadDashboard, filterReadablePageIds } from "@/modules/ee/dashboard-access/lib/spicedb-access";
import {
  getReadablePageIds,
  getReadablePageIdsCached,
  refuseUnlessDashboardOpenable,
} from "./dashboard-read-access";
import { withCachedDashboardDecision } from "./read-decision-cache";

vi.mock("server-only", () => ({}));
vi.mock("@/modules/ee/dashboard-access/lib/spicedb-access", () => ({
  canReadDashboard: vi.fn(),
  filterReadablePageIds: vi.fn(),
}));
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

  test("decides each page on its own cache entry and keeps only the allowed ones", async () => {
    vi.mocked(filterReadablePageIds).mockImplementation(
      async (_subject, pageIds) => new Set(pageIds.filter((pageId) => pageId === "p1"))
    );

    expect(await getReadablePageIdsCached(viewer, dashboard, ["p1", "p2", "p1"], context)).toEqual(
      new Set(["p1"])
    );
    expect(vi.mocked(withCachedDashboardDecision).mock.calls.map((call) => call[0])).toEqual([
      { dashboard, principal: "principal", decision: "page:p1" },
      { dashboard, principal: "principal", decision: "page:p2" },
    ]);
  });
});
