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

    // executeQueryAction now returns { rows, optionLabels?, effectiveQuery } instead of raw array.
    expect(result).toMatchObject({ rows: [{ "FeedbackRecords.count": 1 }] });
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

  // ── Multi-select (MultipleChoiceMulti) detection and splitting ──────────────

  test("executeQueryAction keeps the user's dimension and returns optionLabels for a MultipleChoiceMulti element (no rewrite, no split)", async () => {
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

    // Multi-select now stores one record per option (see transform.ts), so rows arrive already
    // per-option — no joined string to split.
    mocks.executeTenantScopedQuery.mockResolvedValue([
      { "FeedbackRecords.valueText": "One", "FeedbackRecords.count": 8 },
      { "FeedbackRecords.valueText": "Two", "FeedbackRecords.count": 5 },
    ]);

    const result = await executeQueryAction({
      ctx,
      parsedInput: { workspaceId: "workspace-1", query, feedbackDirectoryId: "frd-1" },
    } as any);

    // The query sent to Cube keeps the user's chosen dimension — no swap.
    expect(mocks.executeTenantScopedQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ dimensions: ["FeedbackRecords.valueText"] }),
      })
    );

    // Rows pass through unchanged (no server-side splitting).
    expect(result?.rows).toHaveLength(2);
    // optionLabels is returned so a valueId grouping of the same question reads nicely.
    expect(result?.optionLabels).toEqual({ c1: "One", c2: "Two" });
  });

  test("executeQueryAction passes rows through unchanged and adds no labels for a non-choice element", async () => {
    // A non-choice element type — OpenText — must not be touched.
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

    expect(result?.rows).toHaveLength(1);
    expect(result?.rows?.[0]?.["FeedbackRecords.valueText"]).toBe("Hello, World");
    expect(result).not.toHaveProperty("optionLabels");
  });

  // ── fieldLabel filter fallback (ENG-1673) ────────────────────────────────────

  test("executeQueryAction keeps the user's dimension (no valueText → valueId swap) and still returns optionLabels for a single-select matched by fieldLabel", async () => {
    // The mapping has no customFieldLabel, so the effective label comes from the element headline.
    mocks.getFeedbackSourcesWithMappings.mockResolvedValue([
      {
        formbricksMappings: [{ elementId: "field-sc", surveyId: "survey-sc", customFieldLabel: null }],
      },
    ]);
    mocks.getSurvey.mockResolvedValue({ id: "survey-sc", blocks: [] });
    mocks.getElementsFromBlocks.mockReturnValue([
      {
        id: "field-sc",
        type: "multipleChoiceSingle",
        headline: { default: "Favourite colour?" },
        choices: [
          { id: "c1", label: { default: "Red" } },
          { id: "c2", label: { default: "Blue" } },
        ],
      },
    ]);

    mocks.executeTenantScopedQuery.mockResolvedValue([
      { "FeedbackRecords.valueText": "Red", "FeedbackRecords.count": 10 },
      { "FeedbackRecords.valueText": "Blue", "FeedbackRecords.count": 5 },
    ]);

    const result = await executeQueryAction({
      ctx,
      parsedInput: {
        workspaceId: "workspace-1",
        query: {
          measures: ["FeedbackRecords.count"],
          dimensions: ["FeedbackRecords.valueText"],
          // User filtered by "Question" (fieldLabel), not by fieldId.
          filters: [
            { member: "FeedbackRecords.fieldLabel", operator: "equals", values: ["Favourite colour?"] },
          ],
        },
        feedbackDirectoryId: "frd-1",
      },
    } as any);

    // The query sent to Cube must preserve the user's chosen dimension — no silent swap to valueId.
    expect(mocks.executeTenantScopedQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ dimensions: ["FeedbackRecords.valueText"] }),
      })
    );

    // optionLabels is still returned so a valueId grouping can map ids to human labels.
    expect(result?.optionLabels).toEqual({ c1: "Red", c2: "Blue" });
  });

  test("executeQueryAction returns optionLabels for a multi-select element matched by fieldLabel (no rewrite/split)", async () => {
    mocks.getFeedbackSourcesWithMappings.mockResolvedValue([
      {
        formbricksMappings: [{ elementId: "field-mc", surveyId: "survey-mc", customFieldLabel: null }],
      },
    ]);
    mocks.getSurvey.mockResolvedValue({ id: "survey-mc", blocks: [] });
    mocks.getElementsFromBlocks.mockReturnValue([
      {
        id: "field-mc",
        type: "multipleChoiceMulti",
        headline: { default: "Pick all that apply" },
        choices: [
          { id: "opt1", label: { default: "A" } },
          { id: "opt2", label: { default: "B" } },
        ],
      },
    ]);

    mocks.executeTenantScopedQuery.mockResolvedValue([
      { "FeedbackRecords.valueText": "A", "FeedbackRecords.count": 5 },
      { "FeedbackRecords.valueText": "B", "FeedbackRecords.count": 3 },
    ]);

    const result = await executeQueryAction({
      ctx,
      parsedInput: {
        workspaceId: "workspace-1",
        query: {
          measures: ["FeedbackRecords.count"],
          dimensions: ["FeedbackRecords.valueText"],
          filters: [
            { member: "FeedbackRecords.fieldLabel", operator: "equals", values: ["Pick all that apply"] },
          ],
        },
        feedbackDirectoryId: "frd-1",
      },
    } as any);

    // Dimension preserved (no swap), rows pass through unchanged.
    expect(mocks.executeTenantScopedQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ dimensions: ["FeedbackRecords.valueText"] }),
      })
    );
    expect(result?.rows).toHaveLength(2);
    expect(result?.optionLabels).toEqual({ opt1: "A", opt2: "B" });
  });

  test("executeQueryAction does NOT rewrite when fieldLabel matches multiple mappings (ambiguous)", async () => {
    // Two different mappings share the same effective label — must not guess.
    mocks.getFeedbackSourcesWithMappings.mockResolvedValue([
      {
        formbricksMappings: [
          { elementId: "field-a", surveyId: "survey-a", customFieldLabel: null },
          { elementId: "field-b", surveyId: "survey-b", customFieldLabel: null },
        ],
      },
    ]);
    // Both surveys return an element with the same headline.
    mocks.getSurvey.mockImplementation((id: string) => Promise.resolve({ id, blocks: [] }));
    mocks.getElementsFromBlocks.mockImplementation((blocks: unknown[]) => {
      // Return an element whose headline matches; the elementId will vary per survey.
      // We use a stable element id here because getElementsFromBlocks is mocked globally,
      // but the key point is that both mappings resolve to the same label.
      return [
        {
          id: "field-a",
          type: "multipleChoiceSingle",
          headline: { default: "Duplicate label" },
          choices: [],
        },
        {
          id: "field-b",
          type: "multipleChoiceSingle",
          headline: { default: "Duplicate label" },
          choices: [],
        },
      ];
    });

    const rawRows = [{ "FeedbackRecords.valueText": "X", "FeedbackRecords.count": 1 }];
    mocks.executeTenantScopedQuery.mockResolvedValue(rawRows);

    const result = await executeQueryAction({
      ctx,
      parsedInput: {
        workspaceId: "workspace-1",
        query: {
          measures: ["FeedbackRecords.count"],
          dimensions: ["FeedbackRecords.valueText"],
          filters: [
            { member: "FeedbackRecords.fieldLabel", operator: "equals", values: ["Duplicate label"] },
          ],
        },
        feedbackDirectoryId: "frd-1",
      },
    } as any);

    // Cube must be called with the ORIGINAL (unrewritten) query.
    expect(mocks.executeTenantScopedQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ dimensions: ["FeedbackRecords.valueText"] }),
      })
    );

    // No optionLabels returned.
    expect(result).not.toHaveProperty("optionLabels");
  });

  // ── New: dimension=valueId paths (FIX A + FIX B) ────────────────────────────

  test("executeQueryAction returns effectiveQuery equal to original for a plain count query (no value dimension)", async () => {
    const query = { measures: ["FeedbackRecords.count"] };
    mocks.executeTenantScopedQuery.mockResolvedValue([{ "FeedbackRecords.count": 42 }]);

    const result = await executeQueryAction({
      ctx,
      parsedInput: { workspaceId: "workspace-1", query, feedbackDirectoryId: "frd-1" },
    } as any);

    expect(result?.effectiveQuery).toEqual(query);
    expect(result).not.toHaveProperty("optionLabels");
  });

  test("executeQueryAction keeps valueId dimension and returns optionLabels for a single-select queried directly by valueId + fieldId filter", async () => {
    // User selected "Value (Option)" directly from the picker — dimension is already valueId.
    mocks.getFeedbackSourcesWithMappings.mockResolvedValue([
      {
        formbricksMappings: [{ elementId: "field-sc3", surveyId: "survey-sc3" }],
      },
    ]);
    mocks.getSurvey.mockResolvedValue({ id: "survey-sc3", blocks: [] });
    mocks.getElementsFromBlocks.mockReturnValue([
      {
        id: "field-sc3",
        type: "multipleChoiceSingle",
        headline: { default: "Size?" },
        choices: [
          { id: "s", label: { default: "Small" } },
          { id: "l", label: { default: "Large" } },
        ],
      },
    ]);

    mocks.executeTenantScopedQuery.mockResolvedValue([
      { "FeedbackRecords.valueId": "s", "FeedbackRecords.count": 6 },
      { "FeedbackRecords.valueId": "l", "FeedbackRecords.count": 4 },
    ]);

    const query = {
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.valueId"],
      filters: [{ member: "FeedbackRecords.fieldId", operator: "equals", values: ["field-sc3"] }],
    };

    const result = await executeQueryAction({
      ctx,
      parsedInput: { workspaceId: "workspace-1", query, feedbackDirectoryId: "frd-1" },
    } as any);

    // Cube must receive valueId (no rewrite needed — already the right dimension).
    expect(mocks.executeTenantScopedQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ dimensions: ["FeedbackRecords.valueId"] }),
      })
    );

    // effectiveQuery matches the original (no dimension swap required).
    expect(result?.effectiveQuery).toMatchObject({ dimensions: ["FeedbackRecords.valueId"] });

    // optionLabels must be present so the renderer can map ids to labels.
    expect(result?.optionLabels).toEqual({ s: "Small", l: "Large" });
  });

  test("executeQueryAction keeps valueId (no swap) and returns optionLabels for a multi-select queried by valueId + fieldId filter", async () => {
    // User selected "Value (Option)" for a multi-select field — it must stay valueId, not pop back
    // to Value (Text). Multi-select stores one record per option with its own value_id now.
    mocks.getFeedbackSourcesWithMappings.mockResolvedValue([
      {
        formbricksMappings: [{ elementId: "field-mc2", surveyId: "survey-mc2" }],
      },
    ]);
    mocks.getSurvey.mockResolvedValue({ id: "survey-mc2", blocks: [] });
    mocks.getElementsFromBlocks.mockReturnValue([
      {
        id: "field-mc2",
        type: "multipleChoiceMulti",
        headline: { default: "Interests?" },
        choices: [
          { id: "opt-a", label: { default: "Music" } },
          { id: "opt-b", label: { default: "Sport" } },
        ],
      },
    ]);

    mocks.executeTenantScopedQuery.mockResolvedValue([
      { "FeedbackRecords.valueId": "opt-a", "FeedbackRecords.count": 10 },
      { "FeedbackRecords.valueId": "opt-b", "FeedbackRecords.count": 7 },
    ]);

    const query = {
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.valueId"],
      filters: [{ member: "FeedbackRecords.fieldId", operator: "equals", values: ["field-mc2"] }],
    };

    const result = await executeQueryAction({
      ctx,
      parsedInput: { workspaceId: "workspace-1", query, feedbackDirectoryId: "frd-1" },
    } as any);

    // Cube must have been called with valueId — no swap back to valueText.
    expect(mocks.executeTenantScopedQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ dimensions: ["FeedbackRecords.valueId"] }),
      })
    );

    // effectiveQuery stays on valueId (this is what the builder reflects back — no auto-pop).
    expect(result?.effectiveQuery).toMatchObject({ dimensions: ["FeedbackRecords.valueId"] });

    // optionLabels map the ids to human labels for the renderer.
    expect(result?.optionLabels).toEqual({ "opt-a": "Music", "opt-b": "Sport" });
  });

  test("executeQueryAction uses fieldId filter when both fieldId and fieldLabel filters are present", async () => {
    // fieldId should take precedence; fieldLabel is ignored.
    mocks.getFeedbackSourcesWithMappings.mockResolvedValue([
      {
        formbricksMappings: [{ elementId: "field-sc2", surveyId: "survey-sc2", customFieldLabel: null }],
      },
    ]);
    mocks.getSurvey.mockResolvedValue({ id: "survey-sc2", blocks: [] });
    mocks.getElementsFromBlocks.mockReturnValue([
      {
        id: "field-sc2",
        type: "multipleChoiceSingle",
        headline: { default: "Colour?" },
        choices: [{ id: "cx1", label: { default: "Green" } }],
      },
    ]);

    mocks.executeTenantScopedQuery.mockResolvedValue([
      { "FeedbackRecords.valueText": "Green", "FeedbackRecords.count": 7 },
    ]);

    const result = await executeQueryAction({
      ctx,
      parsedInput: {
        workspaceId: "workspace-1",
        query: {
          measures: ["FeedbackRecords.count"],
          dimensions: ["FeedbackRecords.valueText"],
          filters: [
            { member: "FeedbackRecords.fieldId", operator: "equals", values: ["field-sc2"] },
            { member: "FeedbackRecords.fieldLabel", operator: "equals", values: ["Colour?"] },
          ],
        },
        feedbackDirectoryId: "frd-1",
      },
    } as any);

    // Dimension is preserved (no swap); the returned optionLabels confirm the element was
    // resolved via the fieldId filter (its mapping is the only source that was mocked).
    expect(mocks.executeTenantScopedQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ dimensions: ["FeedbackRecords.valueText"] }),
      })
    );
    expect(result?.optionLabels).toEqual({ cx1: "Green" });
  });
});
