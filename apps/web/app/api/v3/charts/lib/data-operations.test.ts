import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { requireDashboardsAccess } from "@/app/api/v3/lib/dashboards-access";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getV3ChartData, previewV3Chart } from "./data-operations";

/**
 * The chart-query budget (ENG-6586): preview and data spend from one 600/min bucket per user or API
 * key, charged inside the operation so REST and MCP share it, and checked before anything else runs.
 */

vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/app/api/v3/lib/dashboards-access", () => ({
  requireDashboardsAccess: vi.fn(),
  refuseUnlessFeedbackDatasetAccess: vi.fn(),
}));
vi.mock("./access", () => ({ loadAuthorizedChart: vi.fn() }));
vi.mock("@/modules/ee/analysis/lib/run-chart-query", () => ({ runChartQuery: vi.fn() }));

const context = {
  authentication: { apiKeyId: "key_1", workspacePermissions: [] } as never,
  requestId: "req",
  instance: "/api/v3/charts",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(applyRateLimit).mockRejectedValue(
    new TooManyRequestsError("Maximum number of requests reached", 30)
  );
});

describe("chart query budget", () => {
  test("preview and data both spend from the chart-query bucket, per key, and stop at 429", async () => {
    const responses = [
      await previewV3Chart({
        body: {
          workspaceId: "clws000000000000000000001",
          datasetId: "clds000000000000000000001",
          type: "bar",
          query: {},
        },
        ...context,
      }),
      await getV3ChartData({ chartId: "clch000000000000000000001", query: {}, ...context }),
    ];

    for (const response of responses) {
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("30");
    }
    expect(vi.mocked(applyRateLimit).mock.calls).toEqual([
      [rateLimitConfigs.api.v3ChartQueries, "key_1"],
      [rateLimitConfigs.api.v3ChartQueries, "key_1"],
    ]);
    expect(requireDashboardsAccess).not.toHaveBeenCalled();
  });
});
