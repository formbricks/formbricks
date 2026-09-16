import { NoObjectGeneratedError } from "ai";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { AI_CHART_PROMPT_ERROR_CODE } from "./ai-chart-errors";
import { ZAIQueryResponse, generateAIChartQuery } from "./ai-chart-query.server";

const mocks = vi.hoisted(() => ({
  generateOrganizationAIObject: vi.fn(),
  getAIDataProfile: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/ai/service", () => ({
  generateOrganizationAIObject: mocks.generateOrganizationAIObject,
}));

vi.mock("@/modules/ee/analysis/lib/ai-schema-context", () => ({
  generateSchemaContext: vi.fn(() => "schema context"),
}));

vi.mock("@/modules/ee/analysis/lib/ai-data-profile.server", () => ({
  getAIDataProfile: mocks.getAIDataProfile,
}));

describe("generateAIChartQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAIDataProfile.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("returns the AI-generated chart type and normalized query for a clean response", async () => {
    mocks.generateOrganizationAIObject.mockResolvedValueOnce({
      object: {
        name: "Responses by Source Type",
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.sourceType"],
        timeDimensions: null,
        chartType: "bar",
        filters: null,
      },
    });

    const result = await generateAIChartQuery({
      organizationId: "organization-1",
      workspaceId: "workspace-1",
      feedbackDirectoryId: "directory-1",
      userId: "user-1",
      prompt: "responses by sentiment",
    });

    expect(result).toEqual({
      chartType: "bar",
      name: "Responses by Source Type",
      query: {
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.sourceType"],
      },
    });
    expect(mocks.generateOrganizationAIObject).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "organization-1",
        system: "schema context",
        prompt: 'User request: "responses by sentiment"',
        temperature: 0,
        // Counts reasoning tokens too: at 1024 a thinking model spent the whole budget before
        // writing a field. Dropping this back below a few thousand reintroduces that failure.
        maxOutputTokens: 8192,
        timeout: 30000,
      })
    );
  });

  test("maps NPS score prompts to the NPS score measure", async () => {
    mocks.generateOrganizationAIObject.mockResolvedValueOnce({
      object: {
        name: null,
        measures: ["FeedbackRecords.npsScore"],
        dimensions: null,
        timeDimensions: null,
        chartType: "big_number",
        filters: null,
      },
    });

    const result = await generateAIChartQuery({
      organizationId: "organization-1",
      workspaceId: "workspace-1",
      feedbackDirectoryId: "directory-1",
      userId: "user-1",
      prompt: "create a big number chart with the NPS score",
    });

    expect(result).toEqual({
      chartType: "big_number",
      query: { measures: ["FeedbackRecords.npsScore"] },
    });
  });

  test("strips a grouping the model put on a big number, which has no axis for it", async () => {
    mocks.generateOrganizationAIObject.mockResolvedValueOnce({
      object: {
        name: null,
        measures: ["FeedbackRecords.npsScore"],
        dimensions: ["FeedbackRecords.sourceName"],
        timeDimensions: [
          {
            dimension: "FeedbackRecords.collectedAt",
            granularity: "day",
            dateRangePreset: "last 30 days",
            dateRangeStart: null,
            dateRangeEnd: null,
          },
        ],
        chartType: "big_number",
        filters: null,
      },
    });

    const result = await generateAIChartQuery({
      organizationId: "organization-1",
      workspaceId: "workspace-1",
      feedbackDirectoryId: "directory-1",
      userId: "user-1",
      prompt: "NPS score for the last 30 days as a big number",
    });

    // The date range survives as a filter; the grouping it was paired with does not, because the
    // single value cannot be recovered from per-day NPS readings.
    expect(result).toEqual({
      chartType: "big_number",
      query: {
        measures: ["FeedbackRecords.npsScore"],
        timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", dateRange: "last 30 days" }],
      },
    });
  });

  test("falls back to the total count measure when the AI returns no measures", async () => {
    mocks.generateOrganizationAIObject.mockResolvedValueOnce({
      object: {
        name: null,
        measures: [],
        dimensions: null,
        timeDimensions: null,
        chartType: "big_number",
        filters: null,
      },
    });

    const result = await generateAIChartQuery({
      organizationId: "organization-1",
      workspaceId: "workspace-1",
      feedbackDirectoryId: "directory-1",
      userId: "user-1",
      prompt: "show a big number",
    });

    expect(result.query.measures).toEqual(["FeedbackRecords.count"]);
  });

  test("normalizes filters and time dimensions, dropping null-only optional fields", async () => {
    mocks.generateOrganizationAIObject.mockResolvedValueOnce({
      object: {
        name: null,
        measures: ["FeedbackRecords.count"],
        dimensions: null,
        timeDimensions: [
          {
            dimension: "FeedbackRecords.collectedAt",
            granularity: "day",
            dateRangePreset: "last 30 days",
            dateRangeStart: null,
            dateRangeEnd: null,
          },
          {
            dimension: "FeedbackRecords.collectedAt",
            granularity: null,
            dateRangePreset: null,
            dateRangeStart: null,
            dateRangeEnd: null,
          },
        ],
        chartType: "area",
        filters: [
          { member: "FeedbackRecords.sourceType", operator: "equals", values: ["survey"] },
          { member: "FeedbackRecords.sourceType", operator: "set", values: null },
        ],
      },
    });

    const result = await generateAIChartQuery({
      organizationId: "organization-1",
      workspaceId: "workspace-1",
      feedbackDirectoryId: "directory-1",
      userId: "user-1",
      prompt: "trend over time",
    });

    expect(result.query.timeDimensions).toEqual([
      { dimension: "FeedbackRecords.collectedAt", granularity: "day", dateRange: "last 30 days" },
      { dimension: "FeedbackRecords.collectedAt" },
    ]);
    expect(result.query.filters).toEqual([
      { member: "FeedbackRecords.sourceType", operator: "equals", values: ["survey"] },
      { member: "FeedbackRecords.sourceType", operator: "set" },
    ]);
  });

  test("rejects value-based filters without a non-empty values array", () => {
    const result = ZAIQueryResponse.safeParse({
      name: null,
      measures: ["FeedbackRecords.count"],
      dimensions: null,
      timeDimensions: null,
      chartType: "bar",
      filters: [{ member: "FeedbackRecords.sourceType", operator: "equals", values: null }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Filter operator "equals" requires a non-empty values array'
    );
    expect(result.error?.issues[0]?.path).toEqual(["filters", 0, "values"]);
  });

  test("rejects valueless filters that include values", () => {
    const result = ZAIQueryResponse.safeParse({
      name: null,
      measures: ["FeedbackRecords.count"],
      dimensions: null,
      timeDimensions: null,
      chartType: "bar",
      filters: [{ member: "FeedbackRecords.sourceType", operator: "set", values: ["survey"] }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Filter operator "set" must not include values');
    expect(result.error?.issues[0]?.path).toEqual(["filters", 0, "values"]);
  });

  test("allows valueless filters with omitted values", () => {
    const result = ZAIQueryResponse.safeParse({
      name: null,
      measures: ["FeedbackRecords.count"],
      dimensions: null,
      timeDimensions: null,
      chartType: "bar",
      filters: [{ member: "FeedbackRecords.sourceType", operator: "notSet" }],
    });

    expect(result.success).toBe(true);
  });

  test("trims the AI-suggested name and caps it at 255 characters", async () => {
    mocks.generateOrganizationAIObject.mockResolvedValueOnce({
      object: {
        name: `  ${"a".repeat(300)}  `,
        measures: ["FeedbackRecords.count"],
        dimensions: null,
        timeDimensions: null,
        chartType: "bar",
        filters: null,
      },
    });

    const result = await generateAIChartQuery({
      organizationId: "organization-1",
      workspaceId: "workspace-1",
      feedbackDirectoryId: "directory-1",
      userId: "user-1",
      prompt: "responses",
    });

    expect(result.name).toBe("a".repeat(255));
  });

  test("omits the name when the AI returns a blank name", async () => {
    mocks.generateOrganizationAIObject.mockResolvedValueOnce({
      object: {
        name: "   ",
        measures: ["FeedbackRecords.count"],
        dimensions: null,
        timeDimensions: null,
        chartType: "bar",
        filters: null,
      },
    });

    const result = await generateAIChartQuery({
      organizationId: "organization-1",
      workspaceId: "workspace-1",
      feedbackDirectoryId: "directory-1",
      userId: "user-1",
      prompt: "responses",
    });

    expect(result).not.toHaveProperty("name");
  });

  test("converts AI structured-output failures into a prompt error", async () => {
    mocks.generateOrganizationAIObject.mockRejectedValueOnce(
      new NoObjectGeneratedError({
        message: "No object generated",
        response: { id: "test-id", timestamp: new Date(0), modelId: "test-model" },
        usage: {
          inputTokens: undefined,
          inputTokenDetails: {
            noCacheTokens: undefined,
            cacheReadTokens: undefined,
            cacheWriteTokens: undefined,
          },
          outputTokens: undefined,
          outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
          totalTokens: undefined,
        },
        finishReason: "stop",
      })
    );

    await expect(
      generateAIChartQuery({
        organizationId: "organization-1",
        workspaceId: "workspace-1",
        feedbackDirectoryId: "directory-1",
        userId: "user-1",
        prompt: "anything",
      })
    ).rejects.toMatchObject({
      name: InvalidInputError.name,
      message: AI_CHART_PROMPT_ERROR_CODE,
    });
  });

  test("does not convert provider failures", async () => {
    const providerError = new Error("billing disabled");
    mocks.generateOrganizationAIObject.mockRejectedValueOnce(providerError);

    await expect(
      generateAIChartQuery({
        organizationId: "organization-1",
        workspaceId: "workspace-1",
        feedbackDirectoryId: "directory-1",
        userId: "user-1",
        prompt: "anything",
      })
    ).rejects.toBe(providerError);
  });

  test("does not convert non-Error rejections", async () => {
    mocks.generateOrganizationAIObject.mockRejectedValueOnce("string failure");

    await expect(
      generateAIChartQuery({
        organizationId: "organization-1",
        workspaceId: "workspace-1",
        feedbackDirectoryId: "directory-1",
        userId: "user-1",
        prompt: "anything",
      })
    ).rejects.toBe("string failure");
  });

  test("puts the directory's real sources and questions in the system prompt", async () => {
    mocks.getAIDataProfile.mockResolvedValue({
      totalRecords: 42,
      sources: [{ name: "Web widget prod", type: "link" }],
      questions: [{ label: "How happy are you?", fieldType: "rating" }],
      languages: ["en"],
      fieldTypes: ["rating"],
      earliestMonth: "2026-01",
      latestMonth: "2026-09",
      truncated: { sources: false, questions: false, languages: false },
    });
    mocks.generateOrganizationAIObject.mockResolvedValueOnce({
      object: {
        name: null,
        measures: ["FeedbackRecords.count"],
        dimensions: null,
        timeDimensions: null,
        chartType: "bar",
        filters: null,
      },
    });

    await generateAIChartQuery({
      organizationId: "organization-1",
      workspaceId: "workspace-1",
      feedbackDirectoryId: "directory-1",
      userId: "user-1",
      prompt: "responses by source",
    });

    const { system } = mocks.generateOrganizationAIObject.mock.calls[0][0];
    expect(system).toContain("schema context");
    expect(system).toContain("Web widget prod");
    expect(system).toContain("How happy are you?");
  });

  test("turns an explicit window into the tuple the builder reads as a custom range", async () => {
    mocks.generateOrganizationAIObject.mockResolvedValueOnce({
      object: {
        name: null,
        measures: ["FeedbackRecords.count"],
        dimensions: null,
        timeDimensions: [
          {
            dimension: "FeedbackRecords.collectedAt",
            granularity: "month",
            dateRangePreset: null,
            dateRangeStart: "2026-08-01",
            dateRangeEnd: "2026-09-30",
          },
        ],
        chartType: "area",
        filters: null,
      },
    });

    const result = await generateAIChartQuery({
      organizationId: "organization-1",
      workspaceId: "workspace-1",
      feedbackDirectoryId: "directory-1",
      userId: "user-1",
      prompt: "responses in August and September",
    });

    // A tuple, never a string: parseQueryToState lifts this into two Dates and the date-range
    // select shows Custom Range, instead of rendering the raw value as its own dropdown entry.
    expect(result.query.timeDimensions).toEqual([
      {
        dimension: "FeedbackRecords.collectedAt",
        granularity: "month",
        dateRange: ["2026-08-01", "2026-09-30"],
      },
    ]);
  });

  test("drops a date range the model could not express in the fields it was given", async () => {
    mocks.generateOrganizationAIObject.mockResolvedValueOnce({
      object: {
        name: null,
        measures: ["FeedbackRecords.count"],
        dimensions: null,
        timeDimensions: [
          {
            dimension: "FeedbackRecords.collectedAt",
            granularity: null,
            dateRangePreset: null,
            dateRangeStart: "2026-08-01T00:00:00.000Z/2026-09-30T23:59:59.999Z",
            dateRangeEnd: null,
          },
        ],
        chartType: "bar",
        filters: null,
      },
    });

    const result = await generateAIChartQuery({
      organizationId: "organization-1",
      workspaceId: "workspace-1",
      feedbackDirectoryId: "directory-1",
      userId: "user-1",
      prompt: "responses in August and September",
    });

    expect(result.query.timeDimensions).toEqual([{ dimension: "FeedbackRecords.collectedAt" }]);
  });

  test("falls back to the schema-only prompt when the directory cannot be profiled", async () => {
    mocks.getAIDataProfile.mockResolvedValue(null);
    mocks.generateOrganizationAIObject.mockResolvedValueOnce({
      object: {
        name: null,
        measures: ["FeedbackRecords.count"],
        dimensions: null,
        timeDimensions: null,
        chartType: "bar",
        filters: null,
      },
    });

    await generateAIChartQuery({
      organizationId: "organization-1",
      workspaceId: "workspace-1",
      feedbackDirectoryId: "directory-1",
      userId: "user-1",
      prompt: "responses by source",
    });

    expect(mocks.generateOrganizationAIObject.mock.calls[0][0].system).toBe("schema context");
  });
});
