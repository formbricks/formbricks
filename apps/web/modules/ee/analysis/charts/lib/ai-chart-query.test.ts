import { NoObjectGeneratedError } from "ai";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { AI_CHART_PROMPT_ERROR_CODE } from "./ai-chart-errors";
import { ZAIQueryResponse, generateAIChartQuery } from "./ai-chart-query.server";

const mocks = vi.hoisted(() => ({
  generateOrganizationAIObject: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/ai/service", () => ({
  generateOrganizationAIObject: mocks.generateOrganizationAIObject,
}));

vi.mock("@/modules/ee/analysis/lib/ai-schema-context", () => ({
  generateSchemaContext: vi.fn(() => "schema context"),
}));

describe("generateAIChartQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("returns the AI-generated chart type and normalized query for a clean response", async () => {
    mocks.generateOrganizationAIObject.mockResolvedValueOnce({
      object: {
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.sourceType"],
        timeDimensions: null,
        chartType: "bar",
        filters: null,
      },
    });

    const result = await generateAIChartQuery({
      organizationId: "organization-1",
      prompt: "responses by sentiment",
    });

    expect(result).toEqual({
      chartType: "bar",
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
        maxOutputTokens: 1024,
        timeout: 30000,
      })
    );
  });

  test("maps NPS score prompts to the NPS score measure", async () => {
    mocks.generateOrganizationAIObject.mockResolvedValueOnce({
      object: {
        measures: ["FeedbackRecords.npsScore"],
        dimensions: null,
        timeDimensions: null,
        chartType: "big_number",
        filters: null,
      },
    });

    const result = await generateAIChartQuery({
      organizationId: "organization-1",
      prompt: "create a big number chart with the NPS score",
    });

    expect(result).toEqual({
      chartType: "big_number",
      query: { measures: ["FeedbackRecords.npsScore"] },
    });
  });

  test("falls back to the total count measure when the AI returns no measures", async () => {
    mocks.generateOrganizationAIObject.mockResolvedValueOnce({
      object: {
        measures: [],
        dimensions: null,
        timeDimensions: null,
        chartType: "big_number",
        filters: null,
      },
    });

    const result = await generateAIChartQuery({
      organizationId: "organization-1",
      prompt: "show a big number",
    });

    expect(result.query.measures).toEqual(["FeedbackRecords.count"]);
  });

  test("normalizes filters and time dimensions, dropping null-only optional fields", async () => {
    mocks.generateOrganizationAIObject.mockResolvedValueOnce({
      object: {
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

    const result = await generateAIChartQuery({
      organizationId: "organization-1",
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
    mocks.generateOrganizationAIObject.mockRejectedValueOnce(
      new NoObjectGeneratedError({ message: "No object generated" })
    );

    await expect(
      generateAIChartQuery({ organizationId: "organization-1", prompt: "anything" })
    ).rejects.toMatchObject({
      name: InvalidInputError.name,
      message: AI_CHART_PROMPT_ERROR_CODE,
    });
  });

  test("does not convert provider failures", async () => {
    const providerError = new Error("billing disabled");
    mocks.generateOrganizationAIObject.mockRejectedValueOnce(providerError);

    await expect(generateAIChartQuery({ organizationId: "organization-1", prompt: "anything" })).rejects.toBe(
      providerError
    );
  });

  test("does not convert non-Error rejections", async () => {
    mocks.generateOrganizationAIObject.mockRejectedValueOnce("string failure");

    await expect(generateAIChartQuery({ organizationId: "organization-1", prompt: "anything" })).rejects.toBe(
      "string failure"
    );
  });
});
