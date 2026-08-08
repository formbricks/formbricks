import { describe, expect, test } from "vitest";
import type { TMemberFilter } from "@formbricks/types/analysis";
import { FEEDBACK_MEASURE_IDS } from "@/modules/ee/analysis/lib/schema-definition";
import { buildQuestionChartQuery } from "./build-question-chart-query";

const SURVEY = "Asia Cup CSAT";
const QUESTION = "How satisfied are you with your arrival in KSA";

const memberFilters = (filters: unknown): TMemberFilter[] => (filters ?? []) as TMemberFilter[];

describe("buildQuestionChartQuery", () => {
  test("filters by question label with equals by default (no source)", () => {
    const { query } = buildQuestionChartQuery({
      fieldLabel: QUESTION,
      fieldType: "nps",
    });

    expect(memberFilters(query.filters)).toEqual([
      { member: "FeedbackRecords.fieldLabel", operator: "equals", values: [QUESTION] },
    ]);
  });

  test("narrows to a source when sourceName is provided", () => {
    const { query } = buildQuestionChartQuery({
      fieldLabel: QUESTION,
      fieldType: "nps",
      sourceName: SURVEY,
    });

    expect(memberFilters(query.filters)).toEqual([
      { member: "FeedbackRecords.sourceName", operator: "equals", values: [SURVEY] },
      { member: "FeedbackRecords.fieldLabel", operator: "equals", values: [QUESTION] },
    ]);
  });

  test("nps → npsScore as a big number", () => {
    const { query, chartType } = buildQuestionChartQuery({
      fieldLabel: QUESTION,
      fieldType: "nps",
    });
    expect(query.measures).toEqual(["FeedbackRecords.npsScore"]);
    expect(query.dimensions).toBeUndefined();
    expect(chartType).toBe("big_number");
  });

  test("csat → csatScore as a big number", () => {
    const { query, chartType } = buildQuestionChartQuery({
      sourceName: SURVEY,
      fieldLabel: QUESTION,
      fieldType: "csat",
    });
    expect(query.measures).toEqual(["FeedbackRecords.csatScore"]);
    expect(chartType).toBe("big_number");
  });

  test("ces → cesAverage as a big number", () => {
    const { query, chartType } = buildQuestionChartQuery({
      sourceName: SURVEY,
      fieldLabel: QUESTION,
      fieldType: "ces",
    });
    expect(query.measures).toEqual(["FeedbackRecords.cesAverage"]);
    expect(chartType).toBe("big_number");
  });

  test("rating falls back to a count distribution by numeric value when no rating measure exists", () => {
    const ratingAverageAvailable = FEEDBACK_MEASURE_IDS.includes("FeedbackRecords.ratingAverage");
    const { query, chartType } = buildQuestionChartQuery({
      sourceName: SURVEY,
      fieldLabel: QUESTION,
      fieldType: "rating",
    });

    if (ratingAverageAvailable) {
      expect(query.measures).toEqual(["FeedbackRecords.ratingAverage"]);
      expect(chartType).toBe("big_number");
    } else {
      expect(query.measures).toEqual(["FeedbackRecords.count"]);
      expect(query.dimensions).toEqual(["FeedbackRecords.valueNumber"]);
      expect(chartType).toBe("bar");
    }
  });

  test("categorical → response count split by answer label (bar)", () => {
    const { query, chartType } = buildQuestionChartQuery({
      sourceName: SURVEY,
      fieldLabel: "Gender",
      fieldType: "categorical",
    });
    expect(query.measures).toEqual(["FeedbackRecords.count"]);
    expect(query.dimensions).toEqual(["FeedbackRecords.valueText"]);
    expect(chartType).toBe("bar");
  });

  test("boolean → count distribution by boolean value (pie)", () => {
    const { query, chartType } = buildQuestionChartQuery({
      sourceName: SURVEY,
      fieldLabel: "Would you return?",
      fieldType: "boolean",
    });
    expect(query.measures).toEqual(["FeedbackRecords.count"]);
    expect(query.dimensions).toEqual(["FeedbackRecords.valueBoolean"]);
    expect(chartType).toBe("pie");
  });

  test("number → count distribution by numeric value (bar)", () => {
    const { query, chartType } = buildQuestionChartQuery({
      sourceName: SURVEY,
      fieldLabel: "Age",
      fieldType: "number",
    });
    expect(query.measures).toEqual(["FeedbackRecords.count"]);
    expect(query.dimensions).toEqual(["FeedbackRecords.valueNumber"]);
    expect(chartType).toBe("bar");
  });

  test("text → total response count as a big number", () => {
    const { query, chartType } = buildQuestionChartQuery({
      sourceName: SURVEY,
      fieldLabel: "Any other feedback?",
      fieldType: "text",
    });
    expect(query.measures).toEqual(["FeedbackRecords.count"]);
    expect(query.dimensions).toBeUndefined();
    expect(chartType).toBe("big_number");
  });

  test("unknown field type falls back to a response count", () => {
    const { query, chartType } = buildQuestionChartQuery({
      sourceName: SURVEY,
      fieldLabel: QUESTION,
      fieldType: "something-new",
    });
    expect(query.measures).toEqual(["FeedbackRecords.count"]);
    expect(chartType).toBe("big_number");
  });

  test("field type match is case-insensitive", () => {
    const { query } = buildQuestionChartQuery({
      sourceName: SURVEY,
      fieldLabel: QUESTION,
      fieldType: "NPS",
    });
    expect(query.measures).toEqual(["FeedbackRecords.npsScore"]);
  });
});
