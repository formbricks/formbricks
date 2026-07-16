import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { executeQueryAction, generateAIChartAction } from "./actions";

const mocks = vi.hoisted(() => {
  const actionClientAction = vi.fn((fn) => fn);

  return {
    actionClientAction,
    actionClientInputSchema: vi.fn(() => ({ action: actionClientAction })),
    checkWorkspaceAccess: vi.fn(),
    checkFeedbackDirectoryAccess: vi.fn(),
    getIsDashboardsEnabled: vi.fn(),
    createChart: vi.fn(),
    executeTenantScopedQuery: vi.fn(),
    generateAIChartQuery: vi.fn(),
    updateChart: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: mocks.actionClientInputSchema,
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    withContext: vi.fn(() => ({ error: vi.fn() })),
  },
}));

vi.mock("@/modules/ee/analysis/api/lib/cube-client", () => ({
  executeTenantScopedQuery: mocks.executeTenantScopedQuery,
}));

vi.mock("@/modules/ee/analysis/charts/lib/ai-chart-query.server", () => ({
  generateAIChartQuery: mocks.generateAIChartQuery,
}));

vi.mock("@/modules/ee/analysis/charts/lib/charts", () => ({
  createChart: mocks.createChart,
  deleteChart: vi.fn(),
  duplicateChart: vi.fn(),
  getChart: vi.fn(),
  getCharts: vi.fn(),
  updateChart: mocks.updateChart,
}));

vi.mock("@/modules/ee/analysis/lib/access", () => ({
  checkFeedbackDirectoryAccess: mocks.checkFeedbackDirectoryAccess,
  checkWorkspaceAccess: mocks.checkWorkspaceAccess,
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsDashboardsEnabled: mocks.getIsDashboardsEnabled,
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));

const ctx = {
  user: { id: "user-1" },
  auditLoggingCtx: {},
};

describe("chart Cube actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.actionClientAction.mockImplementation((fn) => fn);
    mocks.actionClientInputSchema.mockReturnValue({ action: mocks.actionClientAction });
    mocks.getIsDashboardsEnabled.mockResolvedValue(true);
    mocks.checkWorkspaceAccess.mockResolvedValue({
      organizationId: "organization-1",
      workspaceId: "workspace-1",
    });
    mocks.checkFeedbackDirectoryAccess.mockResolvedValue({
      feedbackDirectoryId: "frd-1",
    });
    mocks.createChart.mockResolvedValue({
      id: "chart-1",
      name: "Chart",
      type: "bar",
      query: { measures: ["FeedbackRecords.count"] },
      config: {},
    });
    mocks.executeTenantScopedQuery.mockResolvedValue([{ "FeedbackRecords.count": 1 }]);
    mocks.updateChart.mockResolvedValue({
      chart: { id: "chart-1", query: { measures: ["FeedbackRecords.count"] } },
      updatedChart: { id: "chart-1", query: { measures: ["FeedbackRecords.count"] } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("executeQueryAction delegates to the tenant-scoped Cube helper after authorization", async () => {
    const query = { measures: ["FeedbackRecords.count"] };

    const result = await executeQueryAction({
      ctx,
      parsedInput: { workspaceId: "workspace-1", query, feedbackDirectoryId: "frd-1" },
    } as any);

    expect(result).toEqual([{ "FeedbackRecords.count": 1 }]);
    expect(mocks.checkWorkspaceAccess).toHaveBeenCalledWith("user-1", "workspace-1", "read");
    expect(mocks.checkFeedbackDirectoryAccess).toHaveBeenCalledWith({
      feedbackDirectoryId: "frd-1",
      organizationId: "organization-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      source: "charts.executeQueryAction",
    });
    expect(mocks.executeTenantScopedQuery).toHaveBeenCalledWith({
      query,
      feedbackDirectoryId: "frd-1",
      workspaceId: "workspace-1",
      organizationId: "organization-1",
      userId: "user-1",
      source: "charts.executeQueryAction",
    });
  });

  test("executeQueryAction does not delegate before workspace authorization succeeds", async () => {
    mocks.checkWorkspaceAccess.mockRejectedValueOnce(new Error("forbidden"));

    await expect(
      executeQueryAction({
        ctx,
        parsedInput: {
          workspaceId: "workspace-1",
          query: { measures: ["FeedbackRecords.count"] },
          feedbackDirectoryId: "frd-1",
        },
      } as any)
    ).rejects.toThrow("forbidden");

    expect(mocks.executeTenantScopedQuery).not.toHaveBeenCalled();
    expect(mocks.checkFeedbackDirectoryAccess).not.toHaveBeenCalled();
  });

  test("generateAIChartAction passes the generated query through to the tenant-scoped Cube helper", async () => {
    mocks.generateAIChartQuery.mockResolvedValueOnce({
      chartType: "bar",
      query: {
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.sourceType"],
      },
      name: "Responses by Source Type",
    });

    const result = await generateAIChartAction({
      ctx,
      parsedInput: {
        workspaceId: "workspace-1",
        prompt: "responses by sentiment",
        feedbackDirectoryId: "frd-1",
      },
    } as any);

    expect(mocks.generateAIChartQuery).toHaveBeenCalledWith({
      organizationId: "organization-1",
      prompt: "responses by sentiment",
    });
    expect(result).toMatchObject({
      chartType: "bar",
      query: {
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.sourceType"],
      },
      data: [{ "FeedbackRecords.count": 1 }],
      suggestedName: "Responses by Source Type",
    });
    expect(mocks.executeTenantScopedQuery).toHaveBeenCalledWith({
      query: {
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.sourceType"],
      },
      feedbackDirectoryId: "frd-1",
      workspaceId: "workspace-1",
      organizationId: "organization-1",
      userId: "user-1",
      source: "charts.generateAIChartAction",
    });
  });

  test("generateAIChartAction does not call the AI lib before access checks succeed", async () => {
    mocks.checkFeedbackDirectoryAccess.mockRejectedValueOnce(new Error("no access"));

    await expect(
      generateAIChartAction({
        ctx,
        parsedInput: {
          workspaceId: "workspace-1",
          prompt: "responses by sentiment",
          feedbackDirectoryId: "frd-1",
        },
      } as any)
    ).rejects.toThrow("no access");

    expect(mocks.generateAIChartQuery).not.toHaveBeenCalled();
    expect(mocks.executeTenantScopedQuery).not.toHaveBeenCalled();
  });

  test("generateAIChartAction does not execute a Cube query when AI generation fails", async () => {
    mocks.generateAIChartQuery.mockRejectedValueOnce(new Error("AI failed"));

    await expect(
      generateAIChartAction({
        ctx,
        parsedInput: {
          workspaceId: "workspace-1",
          prompt: "responses by sentiment",
          feedbackDirectoryId: "frd-1",
        },
      } as any)
    ).rejects.toThrow("AI failed");

    expect(mocks.executeTenantScopedQuery).not.toHaveBeenCalled();
  });
});
