import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getSurveyVariableOperatorOptions, getVariableOperatorOptions } from "./survey-condition-operators";

const t = ((key: string) => key) as unknown as TFunction;

const survey = {
  id: "survey_1",
  blocks: [
    {
      id: "b1",
      elements: [
        {
          id: "fav",
          type: "multipleChoiceSingle",
          required: false,
          headline: { default: "Which one?" },
          choices: [{ id: "c1", label: { default: "Netflix" } }],
        },
        { id: "sat", type: "rating", required: true, headline: { default: "How satisfied?" }, range: 5 },
        { id: "consent", type: "consent", required: false, headline: { default: "May we?" } },
      ],
    },
  ],
  embeddedFields: [],
} as unknown as TSurvey;

const values = (options: { value: unknown }[] | null) => options?.map((option) => option.value) ?? null;

describe("getSurveyVariableOperatorOptions", () => {
  test("a single-select question offers the survey's list for it, its answer state as presence", () => {
    expect(values(getSurveyVariableOperatorOptions("response.fav", survey, t))).toEqual([
      "equals",
      "doesNotEqual",
      "equalsOneOf",
      "isSet",
      "isNotSet",
    ]);
    // The survey's words stay: "Is submitted", not "Is set".
    expect(getSurveyVariableOperatorOptions("response.fav", survey, t)?.at(-2)?.label).toBe(
      "workspace.surveys.edit.is_submitted"
    );
  });

  test("a required question has no Is skipped, as in the survey editor", () => {
    expect(values(getSurveyVariableOperatorOptions("response.sat", survey, t))).toEqual([
      "equals",
      "doesNotEqual",
      "isGreaterThan",
      "isLessThan",
      "isGreaterThanOrEqual",
      "isLessThanOrEqual",
      "isSet",
    ]);
  });

  test("a consent question compares accepted or skipped", () => {
    expect(values(getSurveyVariableOperatorOptions("response.consent", survey, t))).toEqual([
      "isSet",
      "isNotSet",
    ]);
  });

  test("a built-in Survey info value offers its data type's list", () => {
    expect(values(getSurveyVariableOperatorOptions("response.url", survey, t))).toContain("contains");
  });

  test("anything that isn't the survey's own Variable keeps the type-based list", () => {
    expect(getSurveyVariableOperatorOptions("payload.plan", survey, t)).toBeNull();
    expect(getSurveyVariableOperatorOptions("response.gone", survey, t)).toBeNull();
    expect(getSurveyVariableOperatorOptions("response.fav", null, t)).toBeNull();
  });
});

describe("getVariableOperatorOptions", () => {
  test("keeps an operator stored before the list changed, so the select still shows it", () => {
    const options = getVariableOperatorOptions({
      path: "response.fav",
      operator: "contains",
      survey,
      typeHint: "text",
      t,
    });
    expect(values(options)).toContain("contains");
  });

  test("draws number comparisons as the flow editor's symbol pills", () => {
    const options = getVariableOperatorOptions({
      path: "response.sat",
      operator: "isGreaterThan",
      survey,
      typeHint: "number",
      t,
    }) as { value: unknown; symbolOnly?: boolean }[];
    expect(options.find((option) => option.value === "isGreaterThan")?.symbolOnly).toBe(true);
  });
});
