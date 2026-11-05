import { beforeEach, describe, expect, test, vi } from "vitest";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { getDatasetChartFields } from "@/modules/ee/analysis/lib/dataset-chart-fields";
import { getEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-member-name";
import { authorizeDashboardRead, refuseUnlessDashboardDatasetReadable } from "./chart-data-operations";
import { listV3DashboardFilterFields } from "./filter-fields-operations";
import { getDashboardChartsRow } from "./service";

/**
 * The dashboard-bound filter-field list with its collaborators faked: whose keys it lists (the datasets of
 * the dashboard's charts, each read once), how it merges a key several datasets share, and what it refuses.
 */

vi.mock("server-only", () => ({}));
vi.mock("./service", () => ({ getDashboardChartsRow: vi.fn() }));
vi.mock("./chart-data-operations", () => ({
  authorizeDashboardRead: vi.fn(),
  refuseUnlessDashboardDatasetReadable: vi.fn(),
}));
vi.mock("@/app/api/v3/lib/auth", () => ({ getV3AuthorizationActor: vi.fn() }));
vi.mock("@/modules/ee/analysis/lib/dataset-chart-fields", () => ({ getDatasetChartFields: vi.fn() }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));

const DASHBOARD_ID = "cldb000000000000000000001";
const DS_A = "clds000000000000000000001";
const DS_B = "clds000000000000000000002";
const DS_C = "clds000000000000000000003";
const ACCESS = { workspaceId: "clws000000000000000000001", organizationId: "clor000000000000000000001" };
const context = {
  authentication: { user: { id: "user_1" } } as never,
  requestId: "req",
  instance: "/api/v3/dashboards",
};

const fieldOf = (key: string) => ({ name: getEmbeddedMemberName(key), key });
const rowWith = (datasetIds: string[]) => ({
  id: DASHBOARD_ID,
  workspaceId: ACCESS.workspaceId,
  updatedAt: new Date("2026-11-02T00:00:00Z"),
  filters: [],
  widgets: datasetIds.map((feedbackDirectoryId, n) => ({
    chart: { id: `chart${n}`, type: "bar", query: {}, feedbackDirectoryId, updatedAt: new Date() },
  })),
});

const list = () => listV3DashboardFilterFields({ dashboardId: DASHBOARD_ID, ...context });
const bodyOf = async (response: Response) => (await response.json()) as { data: { fields: unknown[] } };

describe("listV3DashboardFilterFields", () => {
  beforeEach(() => {
    vi.mocked(getDashboardChartsRow).mockReset();
    vi.mocked(authorizeDashboardRead)
      .mockReset()
      .mockResolvedValue(ACCESS as never);
    vi.mocked(refuseUnlessDashboardDatasetReadable).mockReset().mockResolvedValue(null);
    vi.mocked(getV3AuthorizationActor)
      .mockReset()
      .mockReturnValue({ type: "user", id: "user_1" } as never);
    vi.mocked(getDatasetChartFields)
      .mockReset()
      .mockImplementation(async ({ datasetId }) => ({
        embeddedFields:
          datasetId === DS_A ? [fieldOf("Tier"), fieldOf("Plan")] : [fieldOf("Plan"), fieldOf("Region")],
      }));
  });

  test("lists the keys of the dashboard's charts' datasets once each, in key order, each dataset read once", async () => {
    vi.mocked(getDashboardChartsRow).mockResolvedValue(rowWith([DS_A, DS_B, DS_A]) as never);

    const response = await list();

    expect(response.status).toBe(200);
    expect((await bodyOf(response)).data.fields).toEqual([
      { ...fieldOf("Plan"), label: "Plan" },
      { ...fieldOf("Region"), label: "Region" },
      { ...fieldOf("Tier"), label: "Tier" },
    ]);
    expect(getDatasetChartFields).toHaveBeenCalledTimes(2);
    expect(getDatasetChartFields).toHaveBeenCalledWith({
      datasetId: DS_A,
      ...ACCESS,
      actor: { type: "user", id: "user_1" },
    });
  });

  test("leaves out a dataset the caller cannot read through the dashboard, without naming its keys", async () => {
    vi.mocked(getDashboardChartsRow).mockResolvedValue(rowWith([DS_A, DS_C]) as never);
    vi.mocked(refuseUnlessDashboardDatasetReadable).mockImplementation(async (_access, datasetId) =>
      datasetId === DS_C ? new Response(null, { status: 403 }) : null
    );

    const response = await list();

    expect(response.status).toBe(200);
    expect((await bodyOf(response)).data.fields).toEqual([
      { ...fieldOf("Plan"), label: "Plan" },
      { ...fieldOf("Tier"), label: "Tier" },
    ]);
    expect(getDatasetChartFields).toHaveBeenCalledTimes(1);
  });

  test("answers an empty list for a dashboard with no charts", async () => {
    vi.mocked(getDashboardChartsRow).mockResolvedValue(rowWith([]) as never);

    const response = await list();

    expect((await bodyOf(response)).data.fields).toEqual([]);
    expect(getDatasetChartFields).not.toHaveBeenCalled();
  });

  test("refuses an unknown dashboard and a caller the dashboard read refuses, before reading any keys", async () => {
    vi.mocked(getDashboardChartsRow).mockResolvedValueOnce(null);
    expect((await list()).status).toBe(403);
    expect(authorizeDashboardRead).not.toHaveBeenCalled();

    vi.mocked(getDashboardChartsRow).mockResolvedValue(rowWith([DS_A]) as never);
    vi.mocked(authorizeDashboardRead).mockResolvedValueOnce(new Response(null, { status: 403 }));
    expect((await list()).status).toBe(403);
    expect(getDatasetChartFields).not.toHaveBeenCalled();
  });

  test("answers 401 without an actor, and maps a thrown error instead of throwing", async () => {
    vi.mocked(getDashboardChartsRow).mockResolvedValue(rowWith([DS_A]) as never);
    vi.mocked(getV3AuthorizationActor).mockReturnValueOnce(null as never);
    expect((await list()).status).toBe(401);

    vi.mocked(getDatasetChartFields).mockRejectedValueOnce(new Error("boom"));
    expect((await list()).status).toBe(500);
  });
});
