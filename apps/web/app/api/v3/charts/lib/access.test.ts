import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  refuseUnlessFeedbackDatasetAccess,
  requireDashboardsAccess,
} from "@/app/api/v3/lib/dashboards-access";
import { problemForbidden, problemUnauthorized } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getSessionUserId, loadAuthorizedChart } from "./access";
import { type TChartResourceRow, getChartResourceRow } from "./service";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/dashboards-access", () => ({
  requireDashboardsAccess: vi.fn(),
  refuseUnlessFeedbackDatasetAccess: vi.fn(),
}));
vi.mock("./service", () => ({ getChartResourceRow: vi.fn() }));

const chartId = "clch000000000000000000001";
const chartWorkspaceId = "clws000000000000000000002";
const session = { user: { id: "user_1" } } as unknown as TV3Authentication;
const context = { authentication: session, requestId: "req_1", instance: "/api/v3/charts" };
const datasetId = "clds000000000000000000001";
const row = {
  id: chartId,
  workspaceId: chartWorkspaceId,
  feedbackDirectoryId: datasetId,
} as TChartResourceRow;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSessionUserId", () => {
  test("is the user behind a session, and null for an API key or no authentication", () => {
    expect(getSessionUserId(session)).toBe("user_1");
    expect(getSessionUserId({ apiKeyId: "key_1" } as unknown as TV3Authentication)).toBeNull();
    expect(getSessionUserId({ user: {} } as unknown as TV3Authentication)).toBeNull();
    expect(getSessionUserId(null)).toBeNull();
  });
});

describe("loadAuthorizedChart", () => {
  test("authorizes the chart's own workspace at the asked permission and returns both", async () => {
    const access = { workspaceId: chartWorkspaceId, organizationId: "clorg00000000000000000001" };
    vi.mocked(getChartResourceRow).mockResolvedValue(row);
    vi.mocked(requireDashboardsAccess).mockResolvedValue(access);

    const loaded = await loadAuthorizedChart(chartId, "readWrite", context);

    expect(loaded).toEqual({ row, access });
    expect(getChartResourceRow).toHaveBeenCalledWith(chartId);
    expect(requireDashboardsAccess).toHaveBeenCalledWith(
      session,
      chartWorkspaceId,
      "readWrite",
      "req_1",
      "/api/v3/charts"
    );
  });

  test("answers a chart that does not exist with 403, without consulting access", async () => {
    vi.mocked(getChartResourceRow).mockResolvedValue(null);

    const loaded = await loadAuthorizedChart(chartId, "read", context);

    expect(loaded).toBeInstanceOf(Response);
    const response = loaded as Response;
    expect(response.status).toBe(403);
    expect(((await response.json()) as { code: string }).code).toBe("forbidden");
    expect(requireDashboardsAccess).not.toHaveBeenCalled();
  });

  test("passes the access gate's refusal through unchanged", async () => {
    const refusal = problemUnauthorized("req_1", "Not authenticated", "/api/v3/charts");
    vi.mocked(getChartResourceRow).mockResolvedValue(row);
    vi.mocked(requireDashboardsAccess).mockResolvedValue(refusal);

    expect(await loadAuthorizedChart(chartId, "read", context)).toBe(refusal);
  });

  test("checks the chart's Feedback Dataset only when asked, at the asked permission", async () => {
    const access = { workspaceId: chartWorkspaceId, organizationId: "clorg00000000000000000001" };
    vi.mocked(getChartResourceRow).mockResolvedValue(row);
    vi.mocked(requireDashboardsAccess).mockResolvedValue(access);
    vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValue(null);

    await loadAuthorizedChart(chartId, "readWrite", context);
    expect(refuseUnlessFeedbackDatasetAccess).not.toHaveBeenCalled();

    expect(
      await loadAuthorizedChart(chartId, "readWrite", context, { datasetPermission: "readWrite" })
    ).toEqual({ row, access });
    expect(refuseUnlessFeedbackDatasetAccess).toHaveBeenCalledWith(
      session,
      access,
      datasetId,
      "readWrite",
      "req_1",
      "/api/v3/charts"
    );
  });

  test("passes the dataset refusal through, and skips the dataset when the workspace refused", async () => {
    const refusal = problemForbidden("req_1", "You are not authorized to use this Feedback Dataset", "/");
    vi.mocked(getChartResourceRow).mockResolvedValue(row);
    vi.mocked(requireDashboardsAccess).mockResolvedValue({
      workspaceId: chartWorkspaceId,
      organizationId: "clorg00000000000000000001",
    });
    vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValue(refusal);

    expect(await loadAuthorizedChart(chartId, "read", context, { datasetPermission: "read" })).toBe(refusal);

    vi.mocked(refuseUnlessFeedbackDatasetAccess).mockClear();
    const workspaceRefusal = problemUnauthorized("req_1", "Not authenticated", "/api/v3/charts");
    vi.mocked(requireDashboardsAccess).mockResolvedValue(workspaceRefusal);
    expect(await loadAuthorizedChart(chartId, "read", context, { datasetPermission: "read" })).toBe(
      workspaceRefusal
    );
    expect(refuseUnlessFeedbackDatasetAccess).not.toHaveBeenCalled();
  });
});
