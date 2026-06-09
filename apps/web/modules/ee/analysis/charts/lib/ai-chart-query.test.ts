import { NoObjectGeneratedError } from "ai";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { AI_CHART_PROMPT_ERROR_CODE } from "./ai-chart-errors";
import { ZAIQueryResponse, generateAIChartQuery } from "./ai-chart-query.server";

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  getAiModel: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/ai", () => ({
  getAiModel: mocks.getAiModel,
}));

vi.mock("@/lib/env", () => ({
  env: {},
}));

vi.mock("@/modules/ee/analysis/lib/ai-schema-context", () => ({
  generateSchemaContext: vi.fn(() => "schema context"),
}));

// Partial mock so NoObjectGeneratedError keeps its real isInstance marker check.
// Faking it by name string masks SDK contract drift.
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    Output: {
      object: vi.fn(({ schema }) => schema),
    },
    generateText: mocks.generateText,
  };
});

describe("generateAIChartQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiModel.mockReturnValue("model");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("returns the AI-generated chart type and normalized query for a clean response", async () => {
    mocks.generateText.mockResolvedValueOnce({
      output: {
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.sourceType"],
        timeDimensions: null,
        chartType: "bar",
        filters: null,
      },
    });

    const result = await generateAIChartQuery("responses by sentiment");

    expect(result).toEqual({
      chartType: "bar",
      query: {
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.sourceType"],
      },
    });
  });

  test("maps NPS score prompts to the NPS score measure", async () => {
    mocks.generateText.mockResolvedValueOnce({
      output: {
        measures: ["FeedbackRecords.npsScore"],
        dimensions: null,
        timeDimensions: null,
        chartType: "big_number",
        filters: null,
      },
    });

    const result = await generateAIChartQuery("create a big number chart with the NPS score");

    expect(result).toEqual({
      chartType: "big_number",
      query: { measures: ["FeedbackRecords.npsScore"] },
    });
  });

  test("falls back to the total count measure when the AI returns no measures", async () => {
    mocks.generateText.mockResolvedValueOnce({
      output: {
        measures: [],
        dimensions: null,
        timeDimensions: null,
        chartType: "big_number",
        filters: null,
      },
    });

    const result = await generateAIChartQuery("show a big number");

    expect(result.query.measures).toEqual(["FeedbackRecords.count"]);
  });

  test("normalizes filters and time dimensions, dropping null-only optional fields", async () => {
    mocks.generateText.mockResolvedValueOnce({
      output: {
        measures: ["FeedbackRecords.count"],
        dimensions: null,
        timeDimensions: [
          { dimension: "FeedbackRecords.collectedAt", granularity: "day", dateRange: "last 30 days" },
          { dimension: "FeedbackRecords.collectedAt", granularity: null, dateRange: null },
        ],
        chartType: "line",
        filters: [
          { member: "FeedbackRecords.sourceType", operator: "equals", values: ["survey"] },
          { member: "FeedbackRecords.sourceType", operator: "set", values: null },
        ],
      },
    });

    const result = await generateAIChartQuery("trend over time");

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
      measures: ["FeedbackRecords.count"],
      dimensions: null,
      timeDimensions: null,
      chartType: "bar",
      filters: [{ member: "FeedbackRecords.sourceType", operator: "notSet" }],
    });

    expect(result.success).toBe(true);
  });

  test("converts AI structured-output failures into a prompt error", async () => {
    mocks.generateText.mockRejectedValueOnce(new NoObjectGeneratedError({ message: "No object generated" }));

    await expect(generateAIChartQuery("anything")).rejects.toMatchObject({
      name: InvalidInputError.name,
      message: AI_CHART_PROMPT_ERROR_CODE,
    });
  });

  test("does not convert provider failures", async () => {
    const providerError = new Error("billing disabled");
    mocks.generateText.mockRejectedValueOnce(providerError);

    await expect(generateAIChartQuery("anything")).rejects.toBe(providerError);
  });

  test("does not convert non-Error rejections", async () => {
    mocks.generateText.mockRejectedValueOnce("string failure");

    await expect(generateAIChartQuery("anything")).rejects.toBe("string failure");
  });
});
