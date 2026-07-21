import { createId } from "@paralleldrive/cuid2";
import { describe, expect, test } from "vitest";
import {
  ZSegmentCreateInput,
  ZSegmentFilters,
  ZSegmentSurveyInteractionFilterValue,
  ZSegmentUpdateInput,
} from "@formbricks/types/segment";

const surveyInteractionFilter = (value: unknown) => [
  {
    id: createId(),
    connector: null,
    resource: {
      id: createId(),
      root: { type: "surveyInteraction" as const },
      qualifier: { operator: "haveSeen" as const },
      value,
    },
  },
];

const validFilters = [
  {
    id: createId(),
    connector: null,
    resource: {
      id: createId(),
      root: {
        type: "attribute" as const,
        contactAttributeKey: "email",
      },
      value: "user@example.com",
      qualifier: {
        operator: "equals" as const,
      },
    },
  },
];

describe("segment schema validation", () => {
  test("keeps base segment filters compatible with empty arrays", () => {
    const result = ZSegmentFilters.safeParse([]);

    expect(result.success).toBe(true);
  });

  test("requires at least one filter when creating a segment", () => {
    const result = ZSegmentCreateInput.safeParse({
      workspaceId: "workspaceId",
      title: "Power users",
      description: "Users with a matching email",
      isPrivate: false,
      filters: [],
      surveyId: "surveyId",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("At least one filter is required");
  });

  test("accepts segment creation with a valid filter", () => {
    const result = ZSegmentCreateInput.safeParse({
      workspaceId: "workspaceId",
      title: "Power users",
      description: "Users with a matching email",
      isPrivate: false,
      filters: validFilters,
      surveyId: "surveyId",
    });

    expect(result.success).toBe(true);
  });

  test("requires at least one filter when updating a segment", () => {
    const result = ZSegmentUpdateInput.safeParse({
      filters: [],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("At least one filter is required");
  });

  test("accepts segment updates with a valid filter", () => {
    const result = ZSegmentUpdateInput.safeParse({
      filters: validFilters,
    });

    expect(result.success).toBe(true);
  });
});

describe("survey interaction filter value validation", () => {
  test("accepts any-survey scope with empty surveyIds", () => {
    const result = ZSegmentSurveyInteractionFilterValue.safeParse({
      surveyScope: "any",
      surveyIds: [],
      within: { amount: 1, unit: "months" },
    });

    expect(result.success).toBe(true);
  });

  test("accepts specific scope with at least one survey", () => {
    const result = ZSegmentSurveyInteractionFilterValue.safeParse({
      surveyScope: "specific",
      surveyIds: ["survey_1"],
      within: { amount: 3, unit: "weeks" },
    });

    expect(result.success).toBe(true);
  });

  test("rejects specific scope with empty surveyIds", () => {
    const result = ZSegmentSurveyInteractionFilterValue.safeParse({
      surveyScope: "specific",
      surveyIds: [],
      within: { amount: 1, unit: "months" },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Select at least one survey");
  });

  test.each([
    { description: "below 1", amount: 0 },
    { description: "above 999", amount: 1000 },
    { description: "non-integer", amount: 2.5 },
  ])("rejects amount $description", ({ amount }) => {
    const result = ZSegmentSurveyInteractionFilterValue.safeParse({
      surveyScope: "any",
      surveyIds: [],
      within: { amount, unit: "days" },
    });

    expect(result.success).toBe(false);
  });

  test("rejects unsupported time unit", () => {
    const result = ZSegmentSurveyInteractionFilterValue.safeParse({
      surveyScope: "any",
      surveyIds: [],
      within: { amount: 1, unit: "years" },
    });

    expect(result.success).toBe(false);
  });

  test("accepts a full survey interaction filter through ZSegmentFilters", () => {
    const result = ZSegmentFilters.safeParse(
      surveyInteractionFilter({
        surveyScope: "specific",
        surveyIds: ["survey_1", "survey_2"],
        within: { amount: 6, unit: "months" },
      })
    );

    expect(result.success).toBe(true);
  });

  test("rejects a survey interaction filter with an invalid value through ZSegmentFilters", () => {
    const result = ZSegmentFilters.safeParse(
      surveyInteractionFilter({
        surveyScope: "specific",
        surveyIds: [],
        within: { amount: 1, unit: "months" },
      })
    );

    expect(result.success).toBe(false);
  });
});
