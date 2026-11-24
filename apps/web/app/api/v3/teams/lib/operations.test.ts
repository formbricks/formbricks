import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireV3OrganizationAccess } from "@/app/api/v3/lib/organization-access";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import {
  TeamDashboardLimitsInvalidError,
  getTeamDashboardLimits,
  getTeamOrganizationId,
  listTeamDashboardOptions,
  replaceTeamDashboardLimits,
} from "@/modules/ee/dashboard-access/lib/team-dashboard-limits";
import { getIsDashboardViewerRoleEnabled } from "@/modules/ee/license-check/lib/utils";
import { getV3TeamDashboardLimits, replaceV3TeamDashboardLimits } from "./operations";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/organization-access", () => ({ requireV3OrganizationAccess: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDashboardViewerRoleEnabled: vi.fn() }));
vi.mock("@/modules/ee/dashboard-access/lib/team-dashboard-limits", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/modules/ee/dashboard-access/lib/team-dashboard-limits")>();
  return {
    TeamDashboardLimitsInvalidError: actual.TeamDashboardLimitsInvalidError,
    getTeamDashboardLimits: vi.fn(),
    getTeamOrganizationId: vi.fn(),
    listTeamDashboardOptions: vi.fn(),
    replaceTeamDashboardLimits: vi.fn(),
  };
});

const organizationId = "clorg00000000000000000001";
const teamId = "clteam00000000000000000001";
const base = { authentication: null, teamId, requestId: "req_1", instance: "/api/v3/x" };

type TJsonBody = { code?: string; invalid_params?: unknown; data?: unknown };
const json = async (response: Response) => (await response.json()) as TJsonBody;

const grant = () => {
  vi.mocked(getTeamOrganizationId).mockResolvedValue(organizationId);
  vi.mocked(requireV3OrganizationAccess).mockResolvedValue({ organizationId });
  vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValue(true);
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("authorization", () => {
  test("answers 403 for a team that does not exist, without asking for access", async () => {
    vi.mocked(getTeamOrganizationId).mockResolvedValue(null);
    expect((await getV3TeamDashboardLimits(base)).status).toBe(403);
    expect(requireV3OrganizationAccess).not.toHaveBeenCalled();
  });

  test("relays the access refusal", async () => {
    vi.mocked(getTeamOrganizationId).mockResolvedValue(organizationId);
    vi.mocked(requireV3OrganizationAccess).mockResolvedValue(new Response(null, { status: 401 }));
    const response = await replaceV3TeamDashboardLimits({ ...base, body: { dashboardIds: [] } });
    expect(response.status).toBe(401);
    expect(replaceTeamDashboardLimits).not.toHaveBeenCalled();
  });

  test("answers dashboard_access_plan_required without Access Control and Dashboards", async () => {
    vi.mocked(getTeamOrganizationId).mockResolvedValue(organizationId);
    vi.mocked(requireV3OrganizationAccess).mockResolvedValue({ organizationId });
    vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValue(false);
    const response = await getV3TeamDashboardLimits(base);
    expect(response.status).toBe(403);
    expect((await json(response)).code).toBe("dashboard_access_plan_required");
    expect(getTeamDashboardLimits).not.toHaveBeenCalled();
  });
});

describe("getV3TeamDashboardLimits", () => {
  test("answers the limit with the dashboards it can name", async () => {
    grant();
    vi.mocked(getTeamDashboardLimits).mockResolvedValue({ teamId, limited: true, dashboardIds: ["d1"] });
    const options = [{ id: "d1", name: "Board", workspaceId: "ws_1", workspaceName: "Web" }];
    vi.mocked(listTeamDashboardOptions).mockResolvedValue(options);

    const response = await getV3TeamDashboardLimits(base);

    expect(response.status).toBe(200);
    expect((await json(response)).data).toEqual({
      teamId,
      limited: true,
      dashboardIds: ["d1"],
      dashboards: options,
    });
    expect(vi.mocked(requireV3OrganizationAccess).mock.calls[0][2]).toBe("read");
  });

  test("answers 403 for a team of another organization", async () => {
    grant();
    vi.mocked(getTeamDashboardLimits).mockResolvedValue(null);
    expect((await getV3TeamDashboardLimits(base)).status).toBe(403);
    expect(listTeamDashboardOptions).not.toHaveBeenCalled();
  });
});

describe("replaceV3TeamDashboardLimits", () => {
  test("replaces the limit, answers it and audits before and after", async () => {
    grant();
    const before = { teamId, limited: false, dashboardIds: [] };
    const after = { teamId, limited: true, dashboardIds: ["d1"] };
    vi.mocked(replaceTeamDashboardLimits).mockResolvedValue({ before, after });
    const auditLog = {} as TV3AuditLog;

    const response = await replaceV3TeamDashboardLimits({
      ...base,
      body: { dashboardIds: ["d1"] },
      auditLog,
    });

    expect(response.status).toBe(200);
    expect((await json(response)).data).toEqual(after);
    expect(vi.mocked(requireV3OrganizationAccess).mock.calls[0][2]).toBe("write");
    expect(replaceTeamDashboardLimits).toHaveBeenCalledWith(organizationId, teamId, ["d1"]);
    expect(auditLog).toMatchObject({
      organizationId,
      targetId: teamId,
      oldObject: { dashboardLimits: before },
      newObject: { dashboardLimits: after },
    });
  });

  test("answers 403 when the team is gone by the write", async () => {
    grant();
    vi.mocked(replaceTeamDashboardLimits).mockResolvedValue(null);
    expect((await replaceV3TeamDashboardLimits({ ...base, body: { dashboardIds: [] } })).status).toBe(403);
  });

  test("answers 422 naming each dashboard outside the team's workspaces", async () => {
    grant();
    vi.mocked(replaceTeamDashboardLimits).mockRejectedValue(new TeamDashboardLimitsInvalidError(["d9"]));
    const response = await replaceV3TeamDashboardLimits({ ...base, body: { dashboardIds: ["d9"] } });
    expect(response.status).toBe(422);
    expect((await json(response)).invalid_params).toEqual([
      { name: "dashboardIds", reason: "d9 is not a dashboard in a workspace the team is granted" },
    ]);
  });

  test("rethrows an unexpected error", async () => {
    grant();
    vi.mocked(replaceTeamDashboardLimits).mockRejectedValue(new Error("boom"));
    await expect(replaceV3TeamDashboardLimits({ ...base, body: { dashboardIds: [] } })).rejects.toThrow(
      "boom"
    );
  });
});
