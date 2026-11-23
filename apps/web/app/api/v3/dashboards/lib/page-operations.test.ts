import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { requireDashboardsAccess } from "@/app/api/v3/lib/dashboards-access";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { canManageDashboardAccess, getPageTeamOptions } from "./page-access";
import {
  createV3DashboardPage,
  deleteV3DashboardPage,
  getV3DashboardPageAccess,
  updateV3DashboardPage,
} from "./page-operations";
import { type TPageWriteResult, createPageRow, deletePageRow, updatePageRow } from "./page-service";
import { getDashboardWorkspaceRow } from "./service";

/**
 * The page operations' HTTP answers: each page-write outcome as a status, the team-limit gate asked only
 * when a limit is sent, and what the audit log records. The transaction logic is in page-service.
 */

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { team: { findMany: vi.fn() } } }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));
vi.mock("@/app/api/v3/lib/dashboards-access", () => ({ requireDashboardsAccess: vi.fn() }));
vi.mock("./service", () => ({ getDashboardWorkspaceRow: vi.fn() }));
vi.mock("./page-service", () => ({ createPageRow: vi.fn(), updatePageRow: vi.fn(), deletePageRow: vi.fn() }));
vi.mock("./page-access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./page-access")>()),
  canManageDashboardAccess: vi.fn(),
  getPageTeamOptions: vi.fn(),
}));

const DASHBOARD_ID = "cldb000000000000000000001";
const PAGE_ID = "clpg000000000000000000001";
const WORKSPACE_ID = "clws000000000000000000001";
const ORGANIZATION_ID = "clor000000000000000000001";
const TEAM_ID = "clte000000000000000000001";

const context = {
  authentication: { user: { id: "user_1" } } as never,
  requestId: "req_1",
  instance: "/api/v3/dashboards/pages",
};

const pageRow = (teamIds: string[] = []) => ({
  id: PAGE_ID,
  name: "Sales",
  order: 1,
  teamLimits: teamIds.map((teamId) => ({ teamId })),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDashboardWorkspaceRow).mockResolvedValue({ id: DASHBOARD_ID, workspaceId: WORKSPACE_ID });
  vi.mocked(requireDashboardsAccess).mockResolvedValue({
    workspaceId: WORKSPACE_ID,
    organizationId: ORGANIZATION_ID,
  });
  vi.mocked(canManageDashboardAccess).mockResolvedValue(false);
});

describe("createV3DashboardPage", () => {
  test("answers 201 with the page and its Location, on write access, and audits it", async () => {
    vi.mocked(createPageRow).mockResolvedValueOnce({ kind: "ok", page: pageRow() });
    const auditLog = {} as TV3AuditLog;

    const response = await createV3DashboardPage({
      dashboardId: DASHBOARD_ID,
      body: { name: "Sales" },
      auditLog,
      ...context,
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/v3/dashboards/${DASHBOARD_ID}/pages/${PAGE_ID}`);
    expect((await response.json()).data).toEqual({ id: PAGE_ID, name: "Sales", order: 1, teamIds: [] });
    expect(vi.mocked(requireDashboardsAccess).mock.calls[0][2]).toBe("readWrite");
    expect(auditLog).toMatchObject({ targetId: PAGE_ID, organizationId: ORGANIZATION_ID });
  });

  test("answers 409 past the page cap, and 403 without write access", async () => {
    vi.mocked(createPageRow).mockResolvedValueOnce({ kind: "full" });
    const full = await createV3DashboardPage({ dashboardId: DASHBOARD_ID, body: { name: "x" }, ...context });
    expect(full.status).toBe(409);

    vi.mocked(requireDashboardsAccess).mockResolvedValueOnce(problemForbidden("req_1"));
    const refused = await createV3DashboardPage({
      dashboardId: DASHBOARD_ID,
      body: { name: "x" },
      ...context,
    });
    expect(refused.status).toBe(403);
    expect(createPageRow).toHaveBeenCalledTimes(1);
  });
});

describe("updateV3DashboardPage", () => {
  const update = (body: { name?: string; teamIds?: string[] | null }, auditLog?: TV3AuditLog) =>
    updateV3DashboardPage({ dashboardId: DASHBOARD_ID, pageId: PAGE_ID, body, auditLog, ...context });

  test("a rename never asks whether the caller may manage access", async () => {
    vi.mocked(updatePageRow).mockResolvedValueOnce({ kind: "ok", page: pageRow() });
    expect((await update({ name: "Sales EMEA" })).status).toBe(200);
    expect(canManageDashboardAccess).not.toHaveBeenCalled();
    expect(updatePageRow).toHaveBeenCalledWith(expect.objectContaining({ canManageAccess: false }));
  });

  test("a team limit asks the gate and audits the teams before and after", async () => {
    vi.mocked(canManageDashboardAccess).mockResolvedValueOnce(true);
    vi.mocked(updatePageRow).mockResolvedValueOnce({
      kind: "ok",
      page: pageRow([TEAM_ID]),
      previous: { name: "Sales", teamIds: [] },
    });
    const auditLog = {} as TV3AuditLog;

    const response = await update({ teamIds: [TEAM_ID] }, auditLog);

    expect(response.status).toBe(200);
    expect(canManageDashboardAccess).toHaveBeenCalledWith(
      context.authentication,
      DASHBOARD_ID,
      ORGANIZATION_ID
    );
    expect(updatePageRow).toHaveBeenCalledWith({
      dashboardId: DASHBOARD_ID,
      workspaceId: WORKSPACE_ID,
      pageId: PAGE_ID,
      name: undefined,
      teamIds: [TEAM_ID],
      canManageAccess: true,
    });
    expect(auditLog).toMatchObject({
      oldObject: { dashboardId: DASHBOARD_ID, id: PAGE_ID, teamIds: [] },
      newObject: { dashboardId: DASHBOARD_ID, id: PAGE_ID, teamIds: [TEAM_ID] },
    });
  });

  test.each<{ result: Exclude<TPageWriteResult, { kind: "ok" | "full" }>; status: number }>([
    { result: { kind: "accessDenied" }, status: 403 },
    { result: { kind: "ineligibleTeams", teamIds: [TEAM_ID] }, status: 422 },
    { result: { kind: "gone" }, status: 403 },
  ])("answers $status for $result.kind", async ({ result, status }) => {
    vi.mocked(updatePageRow).mockResolvedValueOnce(result);
    const response = await update({ teamIds: [TEAM_ID] });
    expect(response.status).toBe(status);
    if (status === 422) expect((await response.json()).invalid_params[0].name).toBe("teamIds");
  });
});

describe("deleteV3DashboardPage", () => {
  test("answers 204 and audits the page with the widgets it took", async () => {
    vi.mocked(deletePageRow).mockResolvedValueOnce({
      kind: "ok",
      removed: { name: "Sales", teamIds: [], widgetIds: ["clwg1"] },
    });
    const auditLog = {} as TV3AuditLog;
    const response = await deleteV3DashboardPage({
      dashboardId: DASHBOARD_ID,
      pageId: PAGE_ID,
      auditLog,
      ...context,
    });
    expect(response.status).toBe(204);
    expect(auditLog).toMatchObject({ targetId: PAGE_ID, oldObject: { widgetIds: ["clwg1"] } });
  });

  test("refuses the dashboard's last page with 409, and a page of another dashboard with 403", async () => {
    vi.mocked(deletePageRow).mockResolvedValueOnce({ kind: "lastPage" });
    expect(
      (await deleteV3DashboardPage({ dashboardId: DASHBOARD_ID, pageId: PAGE_ID, ...context })).status
    ).toBe(409);
    vi.mocked(deletePageRow).mockResolvedValueOnce({ kind: "gone" });
    expect(
      (await deleteV3DashboardPage({ dashboardId: DASHBOARD_ID, pageId: PAGE_ID, ...context })).status
    ).toBe(403);
  });
});

describe("getV3DashboardPageAccess", () => {
  test("an Owner or Manager gets every team a page can be limited to, and the ones already chosen", async () => {
    vi.mocked(canManageDashboardAccess).mockResolvedValueOnce(true);
    vi.mocked(getPageTeamOptions).mockResolvedValueOnce([{ id: "t1", name: "Berlin" }]);
    vi.mocked(prisma.team.findMany).mockResolvedValueOnce([{ id: "t0", name: "Archive" }] as never);

    const response = await getV3DashboardPageAccess({ dashboardId: DASHBOARD_ID, ...context });

    expect((await response.json()).data).toEqual({
      canManageAccess: true,
      teams: [
        { id: "t0", name: "Archive", selectable: false },
        { id: "t1", name: "Berlin", selectable: true },
      ],
    });
  });

  test("an editor who may not manage access gets only the teams pages are limited to, to show them", async () => {
    vi.mocked(prisma.team.findMany).mockResolvedValueOnce([{ id: "t0", name: "Archive" }] as never);

    const response = await getV3DashboardPageAccess({ dashboardId: DASHBOARD_ID, ...context });

    expect((await response.json()).data).toEqual({
      canManageAccess: false,
      teams: [{ id: "t0", name: "Archive", selectable: false }],
    });
    expect(getPageTeamOptions).not.toHaveBeenCalled();
  });
});
