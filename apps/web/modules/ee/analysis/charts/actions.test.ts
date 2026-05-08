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
    getAiModel: vi.fn(),
    assertOrganizationAIConfigured: vi.fn(),
    executeTenantScopedQuery: vi.fn(),
    generateText: vi.fn(),
    updateChart: vi.fn(),
  };
});

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: mocks.actionClientInputSchema,
  },
}));

vi.mock("@/lib/utils/action-client/index", () => ({
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

vi.mock("@formbricks/ai", () => ({
  getAiModel: mocks.getAiModel,
}));

vi.mock("@/lib/ai/service", () => ({
  assertOrganizationAIConfigured: mocks.assertOrganizationAIConfigured,
}));

vi.mock("@/lib/env", () => ({
  env: {},
}));

vi.mock("@/modules/ee/analysis/lib/ai-schema-context", () => ({
  generateSchemaContext: vi.fn(() => "schema context"),
}));

vi.mock("ai", () => ({
  Output: {
    object: vi.fn(({ schema }) => schema),
  },
  generateText: mocks.generateText,
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
    mocks.assertOrganizationAIConfigured.mockResolvedValue(undefined);
    mocks.getAiModel.mockReturnValue("model");
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

  test("generateAIChartAction delegates clean AI queries to the tenant-scoped Cube helper", async () => {
    mocks.generateText.mockResolvedValue({
      output: {
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.sentiment"],
        timeDimensions: null,
        chartType: "bar",
        filters: null,
      },
    });

    const result = await generateAIChartAction({
      ctx,
      parsedInput: {
        workspaceId: "workspace-1",
        prompt: "responses by sentiment",
        feedbackDirectoryId: "frd-1",
      },
    } as any);

    expect(result).toMatchObject({
      chartType: "bar",
      data: [{ "FeedbackRecords.count": 1 }],
    });
    expect(mocks.executeTenantScopedQuery).toHaveBeenCalledWith({
      query: {
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.sentiment"],
      },
      feedbackDirectoryId: "frd-1",
      workspaceId: "workspace-1",
      organizationId: "organization-1",
      userId: "user-1",
      source: "charts.generateAIChartAction",
    });
  });
});
