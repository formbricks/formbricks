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
    getFeedbackSourcesWithMappings: vi.fn(),
    getSurvey: vi.fn(),
    getElementsFromBlocks: vi.fn(),
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

vi.mock("@/lib/feedback-source/service", () => ({
  getFeedbackSourcesWithMappings: mocks.getFeedbackSourcesWithMappings,
}));

// stub server-only modules pulled in by resolveOptionGrouping helpers
vi.mock("@/lib/survey/service", () => ({ getSurvey: mocks.getSurvey }));
vi.mock("@/lib/survey/utils", () => ({ getElementsFromBlocks: mocks.getElementsFromBlocks }));
vi.mock("@formbricks/types/surveys/validation", () => ({ getTextContent: (s: string) => s }));
vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: (obj: Record<string, string>, lang: string) => obj[lang] ?? obj["default"] ?? "",
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
    mocks.getFeedbackSourcesWithMappings.mockResolvedValue([]);
    mocks.getSurvey.mockResolvedValue(null);
    mocks.getElementsFromBlocks.mockReturnValue([]);
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

    // executeQueryAction now returns { rows, optionLabels? } instead of raw array.
    expect(result).toEqual({ rows: [{ "FeedbackRecords.count": 1 }] });
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

  // ── Multi-select (MultipleChoiceMulti) detection and splitting ──────────────

  test("executeQueryAction does NOT rewrite the query for a MultipleChoiceMulti element", async () => {
    // Wire up feedbackSources -> survey -> MultipleChoiceMulti element.
    mocks.getFeedbackSourcesWithMappings.mockResolvedValue([
      {
        formbricksMappings: [{ elementId: "field-multi", surveyId: "survey-multi" }],
      },
    ]);
    mocks.getSurvey.mockResolvedValue({ id: "survey-multi", blocks: [] });
    mocks.getElementsFromBlocks.mockReturnValue([
      {
        id: "field-multi",
        type: "multipleChoiceMulti",
        choices: [
          { id: "c1", label: { default: "One" } },
          { id: "c2", label: { default: "Two" } },
        ],
      },
    ]);

    const query = {
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.valueText"],
      filters: [{ member: "FeedbackRecords.fieldId", operator: "equals", values: ["field-multi"] }],
    };

    // Cube returns a row with a joined value.
    mocks.executeTenantScopedQuery.mockResolvedValue([
      { "FeedbackRecords.valueText": "One, Two", "FeedbackRecords.count": 5 },
      { "FeedbackRecords.valueText": "One", "FeedbackRecords.count": 3 },
    ]);

    const result = await executeQueryAction({
      ctx,
      parsedInput: { workspaceId: "workspace-1", query, feedbackDirectoryId: "frd-1" },
    } as any);

    // The query sent to Cube must still use valueText (no rewrite to valueId).
    expect(mocks.executeTenantScopedQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ dimensions: ["FeedbackRecords.valueText"] }),
      })
    );

    // The returned rows must be split and re-aggregated.
    const rows = result?.rows ?? [];
    const byOption = Object.fromEntries(
      rows.map((r: Record<string, unknown>) => [r["FeedbackRecords.valueText"], r["FeedbackRecords.count"]])
    );
    expect(byOption["One"]).toBe(8); // 5 from the joined row + 3 from the plain row
    expect(byOption["Two"]).toBe(5);

    // No optionLabels in the multi-select path.
    expect(result).not.toHaveProperty("optionLabels");
  });

  test("executeQueryAction does not split rows when the element is NOT MultipleChoiceMulti", async () => {
    // A different element type — OpenText — should not trigger splitting.
    mocks.getFeedbackSourcesWithMappings.mockResolvedValue([
      {
        formbricksMappings: [{ elementId: "field-open", surveyId: "survey-open" }],
      },
    ]);
    mocks.getSurvey.mockResolvedValue({ id: "survey-open", blocks: [] });
    mocks.getElementsFromBlocks.mockReturnValue([{ id: "field-open", type: "openText" }]);

    const rawRows = [{ "FeedbackRecords.valueText": "Hello, World", "FeedbackRecords.count": 2 }];
    mocks.executeTenantScopedQuery.mockResolvedValue(rawRows);

    const result = await executeQueryAction({
      ctx,
      parsedInput: {
        workspaceId: "workspace-1",
        query: {
          measures: ["FeedbackRecords.count"],
          dimensions: ["FeedbackRecords.valueText"],
          filters: [{ member: "FeedbackRecords.fieldId", operator: "equals", values: ["field-open"] }],
        },
        feedbackDirectoryId: "frd-1",
      },
    } as any);

    // The comma in the OpenText value must NOT be treated as a separator.
    expect(result?.rows).toHaveLength(1);
    expect(result?.rows?.[0]?.["FeedbackRecords.valueText"]).toBe("Hello, World");
  });
});
