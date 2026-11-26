import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { authorizeLoadedDashboard } from "@/app/api/v3/dashboards/lib/access";
import {
  getReadablePageIds,
  refuseUnlessDashboardOpenable,
} from "@/app/api/v3/dashboards/lib/dashboard-read-access";
import { getViewerAccessReader } from "@/app/api/v3/lib/dashboards-access";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getViewerAccessRecordMatch } from "@/modules/ee/dashboard-access/lib/viewer-data-access";
import { getDashboardViewerAccessMatch } from "./viewer-access-operations";

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { withContext: vi.fn(() => log) } }));
vi.mock("@formbricks/database", () => ({ prisma: { dashboard: { findUnique: vi.fn() } } }));
vi.mock("@/app/api/v3/dashboards/lib/access", () => ({ authorizeLoadedDashboard: vi.fn() }));
vi.mock("@/app/api/v3/dashboards/lib/dashboard-read-access", () => ({
  getReadablePageIds: vi.fn(),
  refuseUnlessDashboardOpenable: vi.fn(),
}));
vi.mock("@/app/api/v3/lib/dashboards-access", () => ({ getViewerAccessReader: vi.fn() }));
vi.mock("@/modules/ee/dashboard-access/lib/viewer-data-access", () => ({
  getViewerAccessRecordMatch: vi.fn(),
}));

const DASHBOARD_ID = "cldb000000000000000000001";
const WORKSPACE_ID = "clws000000000000000000001";
const ORGANIZATION_ID = "clorg00000000000000000001";
const USER_ID = "clus000000000000000000001";
const VIEWED_AS = "clus000000000000000000009";
const INSTANCE = `/api/internal/dashboards/${DASHBOARD_ID}/viewer-access`;

const session = { user: { id: USER_ID }, expires: "2099-01-01" } as unknown as TV3Authentication;
const access = { workspaceId: WORKSPACE_ID, organizationId: ORGANIZATION_ID, asDashboardViewer: true };
const reader = { userId: VIEWED_AS, organizationId: ORGANIZATION_ID };
const row = {
  id: DASHBOARD_ID,
  workspaceId: WORKSPACE_ID,
  pages: [{ id: "page_open" }, { id: "page_closed" }],
  widgets: [
    { pageId: "page_open", chart: { feedbackDirectoryId: "ds_1" } },
    { pageId: "page_open", chart: { feedbackDirectoryId: "ds_1" } },
    { pageId: "page_open", chart: null },
    { pageId: "page_closed", chart: { feedbackDirectoryId: "ds_hidden" } },
  ],
};

const call = () =>
  getDashboardViewerAccessMatch({
    dashboardId: DASHBOARD_ID,
    viewAs: VIEWED_AS,
    authentication: session,
    requestId: "req_1",
    instance: INSTANCE,
  });

describe("getDashboardViewerAccessMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.dashboard.findUnique).mockResolvedValue(row as never);
    vi.mocked(authorizeLoadedDashboard).mockResolvedValue({ row, access } as never);
    vi.mocked(refuseUnlessDashboardOpenable).mockResolvedValue(null);
    vi.mocked(getReadablePageIds).mockResolvedValue(new Set(["page_open"]));
    vi.mocked(getViewerAccessReader).mockReturnValue(reader);
    vi.mocked(getViewerAccessRecordMatch).mockResolvedValue("unmatched");
  });

  test("checks the datasets on the pages the View as member opens, once each", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { status: "unmatched" } });
    expect(authorizeLoadedDashboard).toHaveBeenCalledWith(row, "read", expect.anything(), {
      allowDashboardViewer: true,
      viewAs: VIEWED_AS,
    });
    expect(getViewerAccessRecordMatch).toHaveBeenCalledWith(reader, ["ds_1"], {
      workspaceId: WORKSPACE_ID,
      actor: { type: "user", id: USER_ID },
    });
  });

  test("answers unrestricted without a check for someone who is not a Dashboard Viewer", async () => {
    vi.mocked(getViewerAccessReader).mockReturnValue(null);
    const response = await call();
    expect(await response.json()).toEqual({ data: { status: "unrestricted" } });
    expect(getViewerAccessRecordMatch).not.toHaveBeenCalled();
  });

  test("answers the dashboard read's refusal for a dashboard the caller cannot read", async () => {
    vi.mocked(authorizeLoadedDashboard).mockResolvedValue(problemForbidden("req_1", undefined, INSTANCE));
    expect((await call()).status).toBe(403);
    expect(getViewerAccessRecordMatch).not.toHaveBeenCalled();
  });

  test("answers 403 when a team dashboard limit keeps the dashboard from the viewer", async () => {
    vi.mocked(refuseUnlessDashboardOpenable).mockResolvedValue(
      problemForbidden("req_1", undefined, INSTANCE)
    );
    expect((await call()).status).toBe(403);
    expect(getViewerAccessRecordMatch).not.toHaveBeenCalled();
  });

  test("answers 403 when the viewer opens none of its pages", async () => {
    vi.mocked(getReadablePageIds).mockResolvedValue(new Set());
    expect((await call()).status).toBe(403);
    expect(getViewerAccessRecordMatch).not.toHaveBeenCalled();
  });

  test("maps a thrown error to a problem response", async () => {
    vi.mocked(getViewerAccessRecordMatch).mockRejectedValue(new Error("boom"));
    expect((await call()).status).toBe(500);
  });
});
